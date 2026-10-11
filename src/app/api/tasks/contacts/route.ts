import { NextRequest, NextResponse } from "next/server";
import { filterContactsByName } from "@/lib/guests/match-contacts";
import { resolveGoogleAccessToken } from "@/lib/tasks/google-access";
import {
  GooglePeopleError,
  listAllGoogleContacts,
  searchGoogleContacts,
} from "@/lib/tasks/google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await resolveGoogleAccessToken();
  if (!access.ok) {
    return NextResponse.json({
      contacts: [],
      message: access.error,
      reconnect: access.reconnect,
    });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) {
    return NextResponse.json({
      contacts: [],
      message: "הקלידו שם לחיפוש באנשי הקשר",
    });
  }

  try {
    let contacts = await searchGoogleContacts(access.accessToken, query).catch((error) => {
      if (error instanceof GooglePeopleError && (error.status === 401 || error.status === 403)) {
        throw error;
      }
      return [];
    });

    if (contacts.length === 0) {
      const all = await listAllGoogleContacts(access.accessToken);
      contacts = filterContactsByName(all, query);
    }

    return NextResponse.json({
      contacts,
      message:
        contacts.length === 0
          ? "לא נמצאו אנשי קשר תואמים ב-Google — נסו שם אחר או הזנה ידנית"
          : null,
    });
  } catch (error) {
    const missingScope =
      error instanceof GooglePeopleError && (error.status === 401 || error.status === 403);
    return NextResponse.json(
      {
        contacts: [],
        error: missingScope
          ? "Google לא אישר גישה לאנשי קשר. התחברו מחדש ואשרו את ההרשאה."
          : "שגיאה בשליפת אנשי קשר מ-Google",
        detail: error instanceof Error ? error.message : "unknown",
        reconnect: missingScope,
      },
      { status: missingScope ? 200 : 500 },
    );
  }
}
