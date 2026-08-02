import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { getGoogleAccessTokenForUser } from "@/lib/tasks/db";
import { searchGoogleContacts } from "@/lib/tasks/google";

export async function GET(request: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

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

    if (query.length < 1) {
      return NextResponse.json({
        contacts: [],
        message: "הקלידו שם לחיפוש באנשי הקשר (תומך גם באלפי אנשי קשר)",
      });
    }

    const contacts = await searchGoogleContacts(accessToken, query);
    return NextResponse.json({
      contacts,
      message:
        contacts.length === 0
          ? "לא נמצאו אנשי קשר תואמים ב-Google — נסו שם אחר או הזנה ידנית"
          : null,
    });
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
