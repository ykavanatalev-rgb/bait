export type ContactCandidate = {
  resourceName: string;
  name: string;
  phone?: string;
};

export type GuestToMatch = {
  id: string;
  name: string;
};

export type ContactMatchOption = {
  name: string;
  phone: string;
};

export type ContactMatch = {
  guestId: string;
  guestName: string;
  status: "matched" | "ambiguous" | "unmatched";
  phone?: string;
  contactName?: string;
  options?: ContactMatchOption[];
};

export function normalizePersonName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/["'״׳`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sortedName(value: string): string {
  return normalizePersonName(value).split(" ").filter(Boolean).sort().join(" ");
}

function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "");
}

function uniquePhones(contacts: ContactCandidate[]): ContactMatchOption[] {
  const seen = new Map<string, ContactMatchOption>();
  for (const contact of contacts) {
    const phone = contact.phone?.trim();
    if (!phone) continue;
    const key = phoneKey(phone);
    if (!key || seen.has(key)) continue;
    seen.set(key, { name: contact.name, phone });
  }
  return [...seen.values()];
}

function decide(
  guest: GuestToMatch,
  contacts: ContactCandidate[],
): ContactMatch {
  const options = uniquePhones(contacts).slice(0, 6);
  if (options.length === 1) {
    return {
      guestId: guest.id,
      guestName: guest.name,
      status: "matched",
      phone: options[0].phone,
      contactName: options[0].name,
    };
  }
  if (options.length > 1) {
    return {
      guestId: guest.id,
      guestName: guest.name,
      status: "ambiguous",
      options,
    };
  }
  return { guestId: guest.id, guestName: guest.name, status: "unmatched" };
}

export function matchGuestsToContacts(
  guests: GuestToMatch[],
  contacts: ContactCandidate[],
): ContactMatch[] {
  const index = new Map<string, ContactCandidate[]>();

  function add(key: string, contact: ContactCandidate) {
    if (!key) return;
    const list = index.get(key);
    if (list) list.push(contact);
    else index.set(key, [contact]);
  }

  for (const contact of contacts) {
    const normalized = normalizePersonName(contact.name);
    add(normalized, contact);
    add(sortedName(contact.name), contact);
  }

  return guests.map((guest) => {
    const normalized = normalizePersonName(guest.name);
    const seen = new Set<string>();
    const found: ContactCandidate[] = [];

    for (const key of new Set([normalized, sortedName(guest.name)])) {
      for (const contact of index.get(key) ?? []) {
        if (seen.has(contact.resourceName)) continue;
        seen.add(contact.resourceName);
        found.push(contact);
      }
    }

    if (found.length === 0 && normalized.split(" ").length >= 2) {
      for (const contact of contacts) {
        const contactName = normalizePersonName(contact.name);
        if (!contactName || seen.has(contact.resourceName)) continue;
        const contactWords = contactName.split(" ").length;
        const includes =
          contactName.includes(normalized) ||
          (normalized.includes(contactName) && contactWords >= 2);
        if (!includes) continue;
        seen.add(contact.resourceName);
        found.push(contact);
      }
    }

    return decide(guest, found);
  });
}

export function filterContactsByName<T extends { name: string; phone?: string }>(
  contacts: T[],
  query: string,
): T[] {
  const needle = normalizePersonName(query);
  const raw = query.trim();
  if (!needle && !raw) return [];

  return contacts
    .filter((contact) => {
      if (needle && normalizePersonName(contact.name).includes(needle)) return true;
      if (raw && contact.phone?.includes(raw)) return true;
      return false;
    })
    .slice(0, 30);
}
