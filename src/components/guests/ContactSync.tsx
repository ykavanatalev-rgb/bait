"use client";

import type { Guest } from "@/lib/guests/types";
import {
  isContactPickerSupported,
  pickContactFromDevice,
} from "@/lib/guests/contacts";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/tasks/scopes";
import type { GoogleContactSummary } from "@/lib/tasks/types";
import { useCallback, useEffect, useState } from "react";

type SaveContactFn = (
  guestId: string,
  categoryId: string,
  contact: { phone: string | null; contact_name: string | null },
) => Promise<void>;

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
  const pickerSupported = isContactPickerSupported();

  const [search, setSearch] = useState(guest.name);
  const [contacts, setContacts] = useState<GoogleContactSummary[]>([]);
  const [contactsMessage, setContactsMessage] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
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
    setContacts([]);
    setContactsMessage(null);
  }, [guest.id, guest.name, guest.phone, guest.contact_name]);

  const getSupabase = useCallback(() => {
    try {
      return createBrowserSupabaseClient();
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "שגיאה בחיבור ל-Supabase בדפדפן",
      );
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      setSignedIn(Boolean(data.session));
      if (!data.session) {
        setContacts([]);
        setContactsMessage("התחברי עם Google כדי לחפש באנשי הקשר (עובד גם באייפון)");
      }
      return Boolean(data.session);
    } catch {
      setSignedIn(false);
      setContactsMessage("שגיאה בבדיקת התחברות");
      return false;
    }
  }, [getSupabase]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  // חיפוש דינמי בשרת (searchContacts) — debounce כדי לא להציף את Google
  useEffect(() => {
    let cancelled = false;
    const term = search.trim();

    if (!signedIn) return;
    if (term.length < 1) {
      setContacts([]);
      setContactsMessage("הקלידו שם לחיפוש באנשי הקשר");
      setLoadingContacts(false);
      return;
    }

    setLoadingContacts(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks/contacts?q=${encodeURIComponent(term)}`);
        const dataJson = (await res.json()) as {
          contacts?: GoogleContactSummary[];
          message?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setContacts([]);
          setContactsMessage(dataJson.error ?? "שגיאה בחיפוש אנשי קשר");
          return;
        }
        setContacts(dataJson.contacts ?? []);
        setContactsMessage(dataJson.message ?? null);
      } catch (err) {
        if (!cancelled) {
          setContactsMessage(err instanceof Error ? err.message : "שגיאה בחיפוש אנשי קשר");
        }
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, signedIn]);

  const suggestions = contacts;

  async function signInGoogle() {
    try {
      const supabase = getSupabase();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: GOOGLE_OAUTH_SCOPES,
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/guests")}`,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהתחברות Google");
    }
  }

  async function applyContact(phone: string, contactName: string) {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError("לא נמצא מספר טלפון — הזיני ידנית למטה");
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
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-contact-title"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-violet-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-violet-100 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="guest-contact-title" className="text-lg font-bold text-slate-900">
                קישור טלפון למוזמן
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
              באייפון אי אפשר לפתוח את פנקס הכתובות של המכשיר מהאתר. התחברי עם Google
              וחפשי למטה, או הזיני טלפון ידנית.
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
                  onClick={() => {
                    // מפעיל מחדש את ה-effect ע"י אותו ערך + tick
                    setSearch((prev) => prev.trim());
                    setContactsMessage(null);
                    setLoadingContacts(true);
                    void (async () => {
                      const term = search.trim();
                      if (!term) {
                        setLoadingContacts(false);
                        setContactsMessage("הקלידו שם לחיפוש באנשי הקשר");
                        return;
                      }
                      try {
                        const res = await fetch(
                          `/api/tasks/contacts?q=${encodeURIComponent(term)}`,
                        );
                        const dataJson = (await res.json()) as {
                          contacts?: GoogleContactSummary[];
                          message?: string | null;
                          error?: string;
                        };
                        if (!res.ok) {
                          setContacts([]);
                          setContactsMessage(dataJson.error ?? "שגיאה בחיפוש");
                          return;
                        }
                        setContacts(dataJson.contacts ?? []);
                        setContactsMessage(dataJson.message ?? null);
                      } catch (err) {
                        setContactsMessage(
                          err instanceof Error ? err.message : "שגיאה בחיפוש",
                        );
                      } finally {
                        setLoadingContacts(false);
                      }
                    })();
                  }}
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
            />

            {loadingContacts && (
              <p className="mt-2 text-center text-xs text-slate-400">מחפש באנשי קשר...</p>
            )}
            {contactsMessage && !loadingContacts && (
              <p className="mt-2 text-xs text-amber-800">{contactsMessage}</p>
            )}

            {!loadingContacts && signedIn && suggestions.length === 0 && search.trim() && !contactsMessage && (
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
