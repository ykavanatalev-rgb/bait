import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/auth-server";
import { upsertTaskProfile } from "@/lib/tasks/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/tasks";

  if (!code) {
    return NextResponse.redirect(new URL("/tasks?error=missing_code", request.url));
  }

  const supabase = await createRouteSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(new URL("/tasks?error=auth_failed", request.url));
  }

  const { session, user } = data;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  try {
    await upsertTaskProfile({
      id: user.id,
      email: user.email ?? "",
      fullName: (metadata.full_name as string) ?? (metadata.name as string) ?? null,
      avatarUrl: (metadata.avatar_url as string) ?? (metadata.picture as string) ?? null,
      refreshToken: session.provider_refresh_token ?? null,
      scopes: session.provider_token ? "granted" : null,
    });
  } catch {
    // אל תפילו את ההתחברות בגלל כשל בשמירת הפרופיל — המשתמש כבר מחובר,
    // ננסה לשמור שוב בפעם הבאה שהוא מתחבר.
  }

  return NextResponse.redirect(new URL(next, request.url));
}
