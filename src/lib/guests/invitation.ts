export const INVITATION_SIDE = "חתן, כלה";

export const INVITATION_HEADERS = [
  "הזמנה לכבוד",
  "מס' אורחים שהוזמנו",
  "צד",
  "קבוצה",
  "סלולרי",
  "טלפון רגיל",
  "אימייל",
  "עיר",
  "רחוב",
  "מיקוד",
  "תא דואר",
  "צ'ק צפוי",
] as const;

const INVITATION_GROUP_ROW = [
  "",
  "",
  "שיוך",
  "",
  "פרטי התקשרות",
  "",
  "",
  "כתובת",
  "",
  "",
  "",
  "",
];

export function invitationGroup(categoryName: string): string {
  const name = categoryName.trim().replace(/\s+/g, " ");
  const folded = name.replace(/["'״׳`]/g, "");

  if (folded.includes("טלי ושלום")) return "אמא כלה, חברים";
  if (folded.includes("שלום עבודה")) return "אבא כלה, חברים";
  if (folded.includes("משפח")) return "משפחה";
  if (folded.startsWith("חברים") || folded.includes("חברים")) return "חברים";
  return name;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function toLocalDigits(raw: string): string {
  let digits = digitsOnly(raw);
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  return digits;
}

export function isMobilePhone(raw: string): boolean {
  const local = toLocalDigits(raw);
  return local.startsWith("05") || local.startsWith("07");
}

export function formatInvitationPhone(raw: string): string {
  const local = toLocalDigits(raw);
  if (local.length === 10 && (local.startsWith("05") || local.startsWith("07"))) {
    return `${local.slice(0, 3)}-${local.slice(3)}`;
  }
  if (local.length === 9 && /^0[23489]/.test(local)) {
    return `${local.slice(0, 2)}-${local.slice(2)}`;
  }
  return raw.trim();
}

export function splitInvitationPhone(raw: string | null | undefined): {
  mobile: string;
  landline: string;
} {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { mobile: "", landline: "" };
  const formatted = formatInvitationPhone(trimmed);
  if (isMobilePhone(trimmed)) return { mobile: formatted, landline: "" };
  return { mobile: "", landline: formatted };
}

export type InvitationGuest = {
  name: string;
  phone: string | null;
  categoryName: string;
};

export function buildInvitationSheet(guests: InvitationGuest[]): (string | number)[][] {
  const rows: (string | number)[][] = [INVITATION_GROUP_ROW, [...INVITATION_HEADERS]];

  for (const guest of guests) {
    const { mobile, landline } = splitInvitationPhone(guest.phone);
    rows.push([
      guest.name,
      1,
      INVITATION_SIDE,
      invitationGroup(guest.categoryName),
      mobile,
      landline,
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  return rows;
}
