export type PickedContact = {
  contactName: string;
  phone: string;
};

type ContactAddress = {
  name?: string[];
  tel?: string[];
};

type ContactsManager = {
  select: (
    properties: string[],
    options?: { multiple?: boolean },
  ) => Promise<ContactAddress[]>;
};

function getContactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const contacts = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  return contacts ?? null;
}

/** Contact Picker API — נתמך בעיקר ב-Chrome באנדרואיד (HTTPS). */
export function isContactPickerSupported(): boolean {
  return getContactsManager() !== null;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, "").trim();
}

export function formatContactDisplay(contact: PickedContact): string {
  if (contact.contactName && contact.phone) {
    return `${contact.contactName} · ${contact.phone}`;
  }
  return contact.phone || contact.contactName || "";
}

/**
 * פותח את בורר אנשי הקשר של המכשיר.
 * חייב להיקרא מתוך לחיצת משתמש (user gesture).
 */
export async function pickContactFromDevice(): Promise<PickedContact | null> {
  const contacts = getContactsManager();
  if (!contacts) {
    throw new Error("בחירת אנשי קשר לא נתמכת בדפדפן זה — הזן טלפון ידנית");
  }

  const selected = await contacts.select(["name", "tel"], { multiple: false });
  const first = selected?.[0];
  if (!first) return null;

  const contactName = (first.name ?? []).map((n) => n.trim()).filter(Boolean).join(" ");
  const phone = normalizePhone((first.tel ?? []).find((t) => t.trim()) ?? "");

  if (!phone && !contactName) return null;

  return { contactName, phone };
}
