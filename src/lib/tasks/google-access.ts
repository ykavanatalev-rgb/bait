import { createRouteSupabaseClient } from "@/lib/supabase/auth-server";
import { getGoogleAccessTokenForUser, upsertTaskProfile } from "@/lib/tasks/db";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/tasks/scopes";

export type GoogleAccess =
  | { ok: true; accessToken: string; userId: string; email: string }
  | { ok: false; error: string; reconnect: boolean; status: number };

export async function resolveGoogleAccessToken(): Promise<GoogleAccess> {
  const supabase = await createRouteSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const user = session?.user;

  if (!session || !user) {
    return {
      ok: false,
      error: "לא מחובר ל-Google. התחברו ואשרו גישה לאנשי קשר.",
      reconnect: true,
      status: 401,
    };
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? "";

  if (session.provider_refresh_token) {
    try {
      await upsertTaskProfile({
        id: user.id,
        email,
        fullName: (metadata.full_name as string) ?? (metadata.name as string) ?? null,
        avatarUrl: (metadata.avatar_url as string) ?? (metadata.picture as string) ?? null,
        refreshToken: session.provider_refresh_token,
        scopes: GOOGLE_OAUTH_SCOPES,
      });
    } catch {
      // נמשיך עם הטוקן גם אם שמירת הפרופיל נכשלה
    }
  }

  const candidates: string[] = [];
  if (session.provider_refresh_token) {
    try {
      const { refreshGoogleAccessToken } = await import("@/lib/tasks/google");
      const refreshed = await refreshGoogleAccessToken(session.provider_refresh_token);
      candidates.push(refreshed.accessToken);
    } catch {
      /* ננסה את הטוקן השמור */
    }
  }

  try {
    const stored = await getGoogleAccessTokenForUser(user.id);
    if (stored) candidates.push(stored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (candidates.length === 0 && /invalid_grant|unauthorized/i.test(message)) {
      return {
        ok: false,
        error: "ההרשאה ל-Google פגה. התחברו מחדש ואשרו גישה לאנשי קשר.",
        reconnect: true,
        status: 401,
      };
    }
  }

  if (session.provider_token) candidates.push(session.provider_token);

  const accessToken = candidates.find(Boolean);
  if (!accessToken) {
    return {
      ok: false,
      error: "אין הרשאה לאנשי קשר. התחברו עם Google ואשרו את הגישה לפנקס.",
      reconnect: true,
      status: 401,
    };
  }

  return { ok: true, accessToken, userId: user.id, email };
}
