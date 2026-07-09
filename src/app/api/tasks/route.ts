import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { createTaskRow, getGoogleAccessTokenForUser, listTasksForUser, updateTaskRow } from "@/lib/tasks/db";
import { createGoogleCalendarEvent } from "@/lib/tasks/google";

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  try {
    const tasks = await listTasksForUser(user.id);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה בטעינת המשימות", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    assigned_to?: string | null;
    due_at?: string | null;
  };

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title הוא שדה חובה" }, { status: 400 });
  }

  try {
    const task = await createTaskRow({
      title,
      description: body.description?.trim() || null,
      createdBy: user.id,
      assignedTo: body.assigned_to || null,
      dueAt: body.due_at || null,
    });

    let calendarWarning: string | null = null;

    if (task.assigned_to && task.due_at) {
      try {
        const accessToken = await getGoogleAccessTokenForUser(task.assigned_to);
        if (accessToken) {
          const start = new Date(task.due_at);
          const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
          const eventId = await createGoogleCalendarEvent(accessToken, {
            title: `משימה: ${task.title}`,
            description: task.description ?? undefined,
            startIso: start.toISOString(),
            endIso: end.toISOString(),
          });
          await updateTaskRow(task.id, { google_event_id: eventId });
        } else {
          calendarWarning = "האחראי/ת עדיין לא חיבר/ה את Google — לא נוצרה תזכורת ביומן";
        }
      } catch (calendarError) {
        calendarWarning =
          calendarError instanceof Error ? calendarError.message : "שגיאה ביצירת תזכורת ביומן";
      }
    }

    return NextResponse.json({ task, calendarWarning }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה ביצירת משימה", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
