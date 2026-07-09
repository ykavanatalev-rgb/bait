import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { getTaskProfile } from "@/lib/tasks/db";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  const profile = await getTaskProfile(user.id);
  return NextResponse.json({ profile });
}
