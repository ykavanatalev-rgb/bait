import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { getGoogleAccessTokenForUser } from "@/lib/tasks/db";
import { fetchGoogleContacts } from "@/lib/tasks/google";

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  try {
    const accessToken = await getGoogleAccessTokenForUser(user.id);
    if (!accessToken) {
      return NextResponse.json(
        {
          contacts: [],
          message: "אין הרשאה לאנשי קשר של Google — התחברו מחדש ואשרו את ההרשאות",
        },
        { status: 200 },
      );
    }

    const contacts = await fetchGoogleContacts(accessToken);
    return NextResponse.json({ contacts });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה בשליפת אנשי קשר מ-Google",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
