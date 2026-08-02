"use client";

import type { Guest } from "@/lib/guests/types";
import {
  isContactPickerSupported,
  pickContactFromDevice,
} from "@/lib/guests/contacts";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/tasks/scopes";
import type { GoogleContactSummary } from "@/lib/tasks/types";
import { useCallback, useEffect, useMemo, useState } from "react";

type SaveContactFn = (
  guestId: string,
  categoryId: string,
  contact: { phone: string | null; contact_name: string | null },
) => Promise<void>;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function rankMatch(guestName: string, contactName: string): number {
  const g = normalize(guestName);
  const c = normalize(contactName);
  if (!g || !c) return 0;
  if (c === g) return 100;
  if (c.includes(g) || g.includes(c)) return 80;
  const gParts = g.split(" ");
  const cParts = c.split(" ");
  const overlap = gParts.filter((p) => p.length > 1 && cParts.some((cp) => cp.includes(p) || p.includes(cp)));
  return overlap.length * 25;
}

export function GuestContactLinker({
  guest,
  categoryName,
  queueIndex,
  queueTotal,
  onSave,
  onSkip,
  onClose,
}: {
  guest: Guest;
  categoryName?: string;
  queueIndex?: number;
  queueTotal?: number;
  onSave: SaveContactFn;
  onSkip?: () => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const pickerSupported = isContactPickerSupported();

  const [search, setSearch] = useState(guest.name);
  const [contacts, setContacts] = useState<GoogleContactSummary[]>([]);
  const [contactsMessage, setContactsMessage] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState(guest.phone ?? "");
  const [manualName, setManualName] = useState(guest.contact_name ?? guest.name);

  useEffect(() => {
    setSearch(guest.name);
    setManualPhone(guest.phone ?? "");
    setManualName(guest.contact_name ?? guest.name);
    setError(null);
  }, [guest.id, guest.name, guest.phone, guest.contact_name]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    setContactsMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      setSignedIn(Boolean(data.session));
      if (!data.session) {
        setContacts([]);
        setContactsMessage("התחברו עם Google כדי לחפש באנשי הקשר (עובד גם באייפון)");
        return;
      }

      const res = await fetch("/api/tasks/contacts");
      const dataJson = (await res.json()) as {
        contacts?: GoogleContactSummary[];
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setContacts([]);
        setContactsMessage(dataJson.error ?? "שגיאה בטעינת אנשי קשר");
        return;
      }
      setContacts(dataJson.contacts ?? []);
      setContactsMessage(dataJson.message ?? null);
    } catch {
      setContactsMessage("שגיאה בטעינת אנשי קשר");
    } finally {
      setLoadingContacts(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const suggestions = useMemo(() => {
    const q = normalize(search);
    const scored = contacts
      .map((c) => ({
        contact: c,
        score: Math.max(rankMatch(guest.name, c.name), q ? rankMatch(q, c.name) : 0),
      }))
      .sort((a, b) => b.score - a.score || a.contact.name.localeCompare(b.contact.name, "he"));

    if (!q || q === normalize(guest.name)) {
      const matched = scored.filter((x) => x.score >= 25).slice(0, 30);
      if (matched.length > 0) return matched.map((x) => x.contact);
      return contacts.slice(0, 40);
    }

    return scored
      .filter((x) => normalize(x.contact.name).includes(q) || x.score >= 25)
      .slice(0, 40)
      .map((x) => x.contact);
  }, [contacts, guest.name, search]);

  async function signInGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: GOOGLE_OAUTH_SCOPES,
        queryParams: { access_type: "offline", prompt: "consent" },
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/guests")}`,
      },
    });
  }

  async function applyContact(phone: string, contactName: string) {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError("לא נמצא מספר טלפון באיש הקשר — הזינו ידנית");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(guest.id, guest.category_id, {
        phone: cleanPhone,
        contact_name: contactName.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setBusy(false);
    }
  }

  async function openDeviceContacts() {
    setError(null);
    try {
      const picked = await pickContactFromDevice();
      if (!picked) return;
      await applyContact(picked.phone, picked.contactName || guest.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לפתוח אנשי קשר במכשיר");
    }
  }

  async function saveManual() {
    await applyContact(manualPhone, manualName);
  }

  const progressLabel =
    queueTotal && queueTotal > 0 && typeof queueIndex === "number"
      ? `${queueIndex + 1} / ${queueTotal}`
      : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="guest-contact-title"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-violet-100"
      >
        <div className="border-b border-violet-100 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="guest-contact-title" className="text-lg font-bold text-slate-900">
                בחרי איש קשר
              </h2>
              {progressLabel && (
                <p className="text-xs font-semibold text-violet-600">{progressLabel}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-center text-base font-bold text-violet-900 ring-1 ring-violet-100">
            {guest.name}
          </p>
          {categoryName && (
            <p className="mt-1 text-center text-xs text-slate-500">{categoryName}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {pickerSupported && (
            <button
              type="button"
              onClick={openDeviceContacts}
              disabled={busy}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              פתח אנשי קשר במכשיר
            </button>
          )}

          {!pickerSupported && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
              באייפון אי אפשר לפתוח את פנקס הכתובות של המכשיר מהאתר. חפשי באנשי הקשר של
              Google למטה (או הזיני טלפון ידנית).
            </p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600">חיפוש באנשי קשר Google</p>
              {!signedIn ? (
                <button
                  type="button"
                  onClick={signInGoogle}
                  className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  התחברות Google
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadContacts()}
                  className="text-xs font-semibold text-violet-700"
                >
                  רענון
                </button>
              )}
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפשי שם..."
              className="w-full rounded-xl border border-violet-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              autoFocus
            />

            {loadingContacts && (
              <p className="mt-2 text-center text-xs text-slate-400">טוען אנשי קשר...</p>
            )}
            {contactsMessage && !loadingContacts && (
              <p className="mt-2 text-xs text-amber-800">{contactsMessage}</p>
            )}

            {!loadingContacts && signedIn && suggestions.length === 0 && (
              <p className="mt-2 text-center text-xs text-slate-400">לא נמצאו תוצאות</p>
            )}

            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {suggestions.map((c) => (
                <li key={c.resourceName}>
                  <button
                    type="button"
                    disabled={busy || !c.phone}
                    onClick={() => void applyContact(c.phone ?? "", c.name)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right hover:bg-violet-50 disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {c.name}
                      </span>
                      <span className="block text-xs text-violet-700" dir="ltr">
                        {c.phone ?? "אין טלפון"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-violet-600">בחר</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500">או הזנה ידנית</p>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="שם באנשי קשר"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
            <input
              type="tel"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="מספר טלפון"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
            <button
              type="button"
              onClick={() => void saveManual()}
              disabled={busy}
              className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              שמור מספר
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
            >
              דלג להבא
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
