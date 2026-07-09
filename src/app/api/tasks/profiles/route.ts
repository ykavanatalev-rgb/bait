import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { listTaskProfiles } from "@/lib/tasks/db";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const profiles = await listTaskProfiles();
  return NextResponse.json({ profiles });
}
