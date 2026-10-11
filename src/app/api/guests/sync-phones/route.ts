import { NextResponse } from "next/server";
import { fetchCategoriesWithGuests, updateGuestContactsBulk } from "@/lib/guests/db";
import { matchGuestsToContacts } from "@/lib/guests/match-contacts";
import { resolveGoogleAccessToken } from "@/lib/tasks/google-access";
import { GooglePeopleError, listAllGoogleContacts } from "@/lib/tasks/google";

export const dynamic = "force-dynamic";

function peopleErrorResponse(error: unknown) {
  if (error instanceof GooglePeopleError) {
    const missingScope = error.status === 403 || error.status === 401;
    return NextResponse.json(
      {
        error: missingScope
          ? "Google לא אישר גישה לאנשי קשר. התחברו מחדש ואשרו את ההרשאה."
          : error.message,
        reconnect: missingScope,
        detail: error.message,
      },
      { status: missingScope ? 401 : 502 },
    );
  }

  const detail = error instanceof Error ? error.message : "unknown";
  return NextResponse.json(
    { error: "שגיאה בשליפת אנשי קשר מ-Google", detail },
    { status: 500 },
  );
}

export async function GET() {
  const access = await resolveGoogleAccessToken();
  if (!access.ok) {
    return NextResponse.json({
      connected: false,
      message: access.error,
      reconnect: access.reconnect,
    });
  }

  return NextResponse.json({ connected: true, email: access.email });
}

export async function POST() {
  const access = await resolveGoogleAccessToken();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, reconnect: access.reconnect },
      { status: access.status },
    );
  }

  try {
    const [categories, contacts] = await Promise.all([
      fetchCategoriesWithGuests(),
      listAllGoogleContacts(access.accessToken),
    ]);

    const missing = categories.flatMap((category) =>
      category.guests
        .filter((guest) => !guest.phone?.trim())
        .map((guest) => ({ id: guest.id, name: guest.name })),
    );

    const matches = matchGuestsToContacts(missing, contacts);
    const matched = matches.filter((match) => match.status === "matched");

    await updateGuestContactsBulk(
      matched.map((match) => ({
        id: match.guestId,
        phone: match.phone ?? "",
        contact_name: match.contactName ?? null,
      })),
    );

    const withPhone = contacts.filter((contact) => contact.phone?.trim()).length;

    return NextResponse.json({
      connected: true,
      googleContacts: contacts.length,
      googleWithPhone: withPhone,
      scanned: missing.length,
      matched: matched.length,
      unmatched: matches.filter((match) => match.status === "unmatched").length,
      alreadyHadPhone:
        categories.reduce((sum, category) => sum + category.guests.length, 0) - missing.length,
      ambiguous: matches
        .filter((match) => match.status === "ambiguous")
        .map((match) => ({
          guestId: match.guestId,
          name: match.guestName,
          options: match.options ?? [],
        })),
      message:
        contacts.length === 0
          ? "החשבון מחובר, אבל לא נמצאו אנשי קשר. ודאו שאנשי הקשר שמורים בחשבון Google הזה."
          : null,
    });
  } catch (error) {
    return peopleErrorResponse(error);
  }
}
