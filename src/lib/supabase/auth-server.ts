import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./config";

/**
 * לקוח Supabase לצד שרת שקורא/כותב את ה-session מתוך cookies.
 * משמש רק כדי לזהות "מי המשתמש המחובר" — לא ל-CRUD על טבלאות
 * (לזה יש createAdminClient עם service_role, בלי RLS policies).
 */
export async function createRouteSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // אפשר להתעלם — קורה כשקוראים ל-setAll מתוך Server Component
        }
      },
    },
  });
}

export async function getCurrentAuthUser() {
  const supabase = await createRouteSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
