import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { listNotificationsForUser, markNotificationsRead } from "@/lib/tasks/db";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const notifications = await listNotificationsForUser(user.id);
  return NextResponse.json({ notifications });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const body = (await request.json()) as { ids?: string[] };
  const ids = body.ids ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true });
}
