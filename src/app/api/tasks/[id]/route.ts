import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import {
  createNotification,
  deleteTaskRow,
  getGoogleAccessTokenForUser,
  getTaskById,
  updateTaskRow,
} from "@/lib/tasks/db";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/lib/tasks/google";

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

async function requireAccess(taskId: string, userId: string) {
  const task = await getTaskById(taskId);
  if (!task) return { task: null, allowed: false };
  const allowed = task.created_by === userId || task.assigned_to === userId;
  return { task, allowed };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { id } = await params;
  const { task: existing, allowed } = await requireAccess(id, user.id);
  if (!existing) {
    return NextResponse.json({ error: "המשימה לא נמצאה" }, { status: 404 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "אין הרשאה לעדכן משימה זו" }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string | null;
    assigned_to?: string | null;
    due_at?: string | null;
    status?: "open" | "done";
    completion_summary?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to || null;
  if (body.due_at !== undefined) patch.due_at = body.due_at || null;
  if (body.status !== undefined) patch.status = body.status;
  if (body.completion_summary !== undefined) {
    patch.completion_summary = body.completion_summary?.trim() || null;
  }

  try {
    const updated = await updateTaskRow(id, patch);
    let calendarWarning: string | null = null;

    const assigneeId = updated.assigned_to;
    const isNowDone = body.status === "done" && existing.status !== "done";

    if (isNowDone) {
      await createNotification({
        userId: updated.created_by,
        taskId: updated.id,
        message: updated.completion_summary
          ? `המשימה "${updated.title}" בוצעה: ${updated.completion_summary}`
          : `המשימה "${updated.title}" סומנה כבוצעה`,
      });
    }

    if (assigneeId && updated.due_at) {
      try {
        const accessToken = await getGoogleAccessTokenForUser(assigneeId);
        if (accessToken) {
          const start = new Date(updated.due_at);
          const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
          const title = isNowDone ? `✔ ${updated.title}` : `משימה: ${updated.title}`;
          const description = updated.completion_summary
            ? `${updated.description ?? ""}\n\nסיכום: ${updated.completion_summary}`.trim()
            : updated.description ?? undefined;

          const existingEventId = existing.google_event_id;
          if (existingEventId) {
            await updateGoogleCalendarEvent(accessToken, existingEventId, {
              title,
              description,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
            });
          } else {
            const eventId = await createGoogleCalendarEvent(accessToken, {
              title,
              description,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
            });
            await updateTaskRow(updated.id, { google_event_id: eventId });
          }
        }
      } catch (calendarError) {
        calendarWarning =
          calendarError instanceof Error ? calendarError.message : "שגיאה בסנכרון תזכורת ביומן";
      }
    }

    return NextResponse.json({ task: updated, calendarWarning });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה בעדכון משימה", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const { id } = await params;
  const { task, allowed } = await requireAccess(id, user.id);
  if (!task) {
    return NextResponse.json({ error: "המשימה לא נמצאה" }, { status: 404 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "אין הרשאה למחוק משימה זו" }, { status: 403 });
  }

  const eventId = task.google_event_id;
  if (eventId && task.assigned_to) {
    try {
      const accessToken = await getGoogleAccessTokenForUser(task.assigned_to);
      if (accessToken) await deleteGoogleCalendarEvent(accessToken, eventId);
    } catch {
      // לא חוסמים מחיקה בגלל כשל בסנכרון היומן
    }
  }

  await deleteTaskRow(id);
  return NextResponse.json({ ok: true });
}
