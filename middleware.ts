import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

// מרענן את ה-session של Supabase Auth (עמוד /tasks) בכל בקשה,
// כדי שהמשתמש לא יתנתק פתאום כשה-access token של Supabase מתיישן.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/",
    "/tasks/:path*",
    "/infrastructure/:path*",
    "/auth/:path*",
    "/api/tasks/:path*",
    "/api/infrastructure/:path*",
  ],
};
