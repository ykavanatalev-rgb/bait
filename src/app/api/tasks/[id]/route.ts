import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { createNotification, deleteTaskRow, getTaskById, updateTaskRow } from "@/lib/tasks/db";
import { deleteTaskCalendarEvents, syncTaskCalendarEvents } from "@/lib/tasks/calendar-sync";

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
    await updateTaskRow(id, patch);
    const updated = (await getTaskById(id))!;
    const isNowDone = body.status === "done" && existing.status !== "done";

    if (isNowDone) {
      await createNotification({
        userId: updated.created_by,
        taskId: updated.id,
        message: updated.completion_summary
          ? `"${updated.assigned_to_profile?.full_name ?? updated.assigned_to_profile?.email ?? "מישהו"}" ביצע/ה את "${updated.title}": ${updated.completion_summary}`
          : `המשימה "${updated.title}" בוצעה`,
      });
    }

    const { warning } = await syncTaskCalendarEvents(updated);
    const finalTask = (await getTaskById(id)) ?? updated;

    return NextResponse.json({ task: finalTask, calendarWarning: warning });
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

  await deleteTaskCalendarEvents(task);
  await deleteTaskRow(id);
  return NextResponse.json({ ok: true });
}
