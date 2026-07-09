import { getGoogleClientId, getGoogleClientSecret } from "@/lib/supabase/config";

export { GOOGLE_OAUTH_SCOPES } from "./scopes";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PEOPLE_API_BASE = "https://people.googleapis.com/v1";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * מממש refresh_token ל-access_token טרי. משמש כל פעם שהשרת צריך
 * לגשת ל-Calendar/People API בשם משתמש רשום — כולל כשמישהו אחר
 * (לא המשתמש עצמו) יוצר לו משימה עם תזכורת ביומן.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("חסרים GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET בסביבת השרת");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      `רענון טוקן Google נכשל: ${body.error ?? response.status} ${body.error_description ?? ""}`.trim(),
    );
  }

  return { accessToken: body.access_token, expiresIn: body.expires_in ?? 3600 };
}

export interface GoogleContact {
  resourceName: string;
  name: string;
  email?: string;
  phone?: string;
}

export async function fetchGoogleContacts(accessToken: string): Promise<GoogleContact[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [connectionsRes, otherRes] = await Promise.all([
    fetch(
      `${PEOPLE_API_BASE}/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=300`,
      { headers },
    ),
    fetch(`${PEOPLE_API_BASE}/otherContacts?readMask=names,emailAddresses&pageSize=300`, {
      headers,
    }),
  ]);

  const contacts: GoogleContact[] = [];

  if (connectionsRes.ok) {
    const data = (await connectionsRes.json()) as {
      connections?: Array<{
        resourceName: string;
        names?: { displayName?: string }[];
        emailAddresses?: { value?: string }[];
        phoneNumbers?: { value?: string }[];
      }>;
    };
    for (const person of data.connections ?? []) {
      const name = person.names?.[0]?.displayName;
      if (!name) continue;
      contacts.push({
        resourceName: person.resourceName,
        name,
        email: person.emailAddresses?.[0]?.value,
        phone: person.phoneNumbers?.[0]?.value,
      });
    }
  }

  if (otherRes.ok) {
    const data = (await otherRes.json()) as {
      otherContacts?: Array<{
        resourceName: string;
        names?: { displayName?: string }[];
        emailAddresses?: { value?: string }[];
      }>;
    };
    for (const person of data.otherContacts ?? []) {
      const name = person.names?.[0]?.displayName ?? person.emailAddresses?.[0]?.value;
      if (!name) continue;
      contacts.push({
        resourceName: person.resourceName,
        name,
        email: person.emailAddresses?.[0]?.value,
      });
    }
  }

  return contacts;
}

interface CalendarEventInput {
  title: string;
  description?: string;
  startIso: string;
  endIso: string;
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  event: CalendarEventInput,
): Promise<string> {
  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.title,
      description: event.description,
      start: { dateTime: event.startIso },
      end: { dateTime: event.endIso },
      reminders: { useDefault: true },
    }),
  });

  const body = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !body.id) {
    throw new Error(body.error?.message ?? "יצירת אירוע ביומן Google נכשלה");
  }
  return body.id;
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  event: CalendarEventInput,
): Promise<void> {
  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.title,
      description: event.description,
      start: { dateTime: event.startIso },
      end: { dateTime: event.endIso },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? "עדכון אירוע ביומן Google נכשל");
  }
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  await fetch(`${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {
    // אם האירוע נמחק/לא קיים כבר — לא מפילים את הבקשה בגלל זה
  });
}
