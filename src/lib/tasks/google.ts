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

type PeoplePerson = {
  resourceName?: string;
  names?: { displayName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
};

function compactPhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

function isMobileNumber(raw: string): boolean {
  const compact = compactPhone(raw);
  const local = compact.replace(/^(?:\+|00)?972/, "0");
  return /^0?5\d/.test(local) || /^0?7\d/.test(local);
}

function pickPhone(numbers?: { value?: string }[]): string | undefined {
  const values = (numbers ?? [])
    .map((n) => n.value?.trim())
    .filter((value): value is string => Boolean(value));
  return values.find((value) => isMobileNumber(value)) ?? values[0];
}

export class GooglePeopleError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function mapPerson(person: PeoplePerson): GoogleContact | null {
  const name =
    person.names?.[0]?.displayName?.trim() ||
    person.emailAddresses?.[0]?.value?.trim() ||
    "";
  if (!name || !person.resourceName) return null;
  return {
    resourceName: person.resourceName,
    name,
    email: person.emailAddresses?.[0]?.value,
    phone: pickPhone(person.phoneNumbers),
  };
}

type PeopleListResponse = {
  connections?: PeoplePerson[];
  otherContacts?: PeoplePerson[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

const contactListCache = new Map<string, { expires: number; contacts: GoogleContact[] }>();

async function readPeopleError(response: Response): Promise<GooglePeopleError> {
  const body = (await response.json().catch(() => ({}))) as PeopleListResponse;
  return new GooglePeopleError(
    body.error?.message ?? `People API ${response.status}`,
    response.status,
  );
}

async function listPeoplePages(
  accessToken: string,
  firstUrl: string,
  listKey: "connections" | "otherContacts",
): Promise<PeoplePerson[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const people: PeoplePerson[] = [];
  let url: string | null = firstUrl;

  for (let page = 0; url && page < 30; page += 1) {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) throw await readPeopleError(response);
    const data = (await response.json()) as PeopleListResponse;
    people.push(...(data[listKey] ?? []));
    url = data.nextPageToken
      ? `${firstUrl}&pageToken=${encodeURIComponent(data.nextPageToken)}`
      : null;
  }

  return people;
}

/**
 * כל אנשי הקשר של החשבון, כולל טלפון.
 * searchContacts של Google מחזיר ריק לעיתים קרובות בעברית — הרשימה המלאה אמינה יותר.
 */
export async function listAllGoogleContacts(accessToken: string): Promise<GoogleContact[]> {
  const cacheKey = accessToken.slice(-24);
  const cached = contactListCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.contacts;

  const connections = await listPeoplePages(
    accessToken,
    `${PEOPLE_API_BASE}/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=1000`,
    "connections",
  );

  let others: PeoplePerson[] = [];
  try {
    others = await listPeoplePages(
      accessToken,
      `${PEOPLE_API_BASE}/otherContacts?readMask=names,emailAddresses,phoneNumbers&pageSize=1000`,
      "otherContacts",
    );
  } catch {
    // other contacts are optional — the main address book is enough
  }

  const contacts: GoogleContact[] = [];
  const seen = new Set<string>();
  for (const person of [...connections, ...others]) {
    const mapped = mapPerson(person);
    if (!mapped || seen.has(mapped.resourceName)) continue;
    seen.add(mapped.resourceName);
    contacts.push(mapped);
  }

  contactListCache.set(cacheKey, { expires: Date.now() + 3 * 60 * 1000, contacts });
  return contacts;
}

/**
 * חיפוש דינמי באנשי קשר (מתאים לאלפי אנשי קשר).
 * משתמש ב-people.searchContacts + otherContacts.search במקום
 * connections.list עם pageSize מוגבל.
 */
export async function searchGoogleContacts(
  accessToken: string,
  query: string,
): Promise<GoogleContact[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const headers = { Authorization: `Bearer ${accessToken}` };

  // Google דורש warmup של אינדקס החיפוש לפני searchContacts
  await fetch(
    `${PEOPLE_API_BASE}/people/me/connections?personFields=names&pageSize=1`,
    { headers },
  ).catch(() => {
    /* warmup best-effort */
  });

  const params = new URLSearchParams({
    query: q,
    readMask: "names,phoneNumbers,emailAddresses",
    pageSize: "30",
  });

  const [contactsRes, otherRes] = await Promise.all([
    fetch(`${PEOPLE_API_BASE}/people:searchContacts?${params}`, { headers }),
    fetch(`${PEOPLE_API_BASE}/otherContacts:search?${params}`, { headers }),
  ]);

  const contacts: GoogleContact[] = [];
  const seen = new Set<string>();

  function pushPerson(person: PeoplePerson | undefined) {
    if (!person) return;
    const mapped = mapPerson(person);
    if (!mapped || seen.has(mapped.resourceName)) return;
    seen.add(mapped.resourceName);
    contacts.push(mapped);
  }

  if (contactsRes.ok) {
    const data = (await contactsRes.json()) as {
      results?: Array<{ person?: PeoplePerson }>;
    };
    for (const row of data.results ?? []) pushPerson(row.person);
  } else {
    const errBody = (await contactsRes.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new GooglePeopleError(
      errBody.error?.message ?? `חיפוש אנשי קשר נכשל (${contactsRes.status})`,
      contactsRes.status,
    );
  }

  if (otherRes.ok) {
    const data = (await otherRes.json()) as {
      results?: Array<{ person?: PeoplePerson }>;
    };
    for (const row of data.results ?? []) pushPerson(row.person);
  }

  return contacts;
}

/** @deprecated עדיף searchGoogleContacts — מוגבל ל-300 אנשי קשר */
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
      connections?: PeoplePerson[];
    };
    for (const person of data.connections ?? []) {
      const mapped = mapPerson(person);
      if (mapped) contacts.push(mapped);
    }
  }

  if (otherRes.ok) {
    const data = (await otherRes.json()) as {
      otherContacts?: PeoplePerson[];
    };
    for (const person of data.otherContacts ?? []) {
      const mapped = mapPerson(person);
      if (mapped) contacts.push(mapped);
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
