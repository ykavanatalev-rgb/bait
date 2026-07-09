import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { createTaskRow, getTaskById, listTasksForUser } from "@/lib/tasks/db";
import { syncTaskCalendarEvents } from "@/lib/tasks/calendar-sync";

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

    const { warning } = await syncTaskCalendarEvents(task);
    const finalTask = (await getTaskById(task.id)) ?? task;

    return NextResponse.json({ task: finalTask, calendarWarning: warning }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה ביצירת משימה", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
