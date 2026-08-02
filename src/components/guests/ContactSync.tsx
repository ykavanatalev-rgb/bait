"use client";

import type { Guest } from "@/lib/guests/types";
import {
  isContactPickerSupported,
  pickContactFromDevice,
  type PickedContact,
} from "@/lib/guests/contacts";
import { useEffect, useState } from "react";

type SaveContactFn = (
  guestId: string,
  categoryId: string,
  contact: { phone: string | null; contact_name: string | null },
) => Promise<void>;

export function ContactSyncPrompt({
  open,
  missingCount,
  pickerSupported,
  onStart,
  onDismiss,
}: {
  open: boolean;
  missingCount: number;
  pickerSupported: boolean;
  onStart: () => void;
  onDismiss: () => void;
}) {
  if (!open || missingCount === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="contacts-sync-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-violet-100"
      >
        <h2 id="contacts-sync-title" className="text-lg font-bold text-slate-900">
          סינכרון לאנשי קשר
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          יש {missingCount} מוזמנים בלי מספר טלפון. עבור כל שם נפתח את אנשי הקשר במכשיר —
          חפשו את השם, אשרו, והמספר יישמר לייצוא Excel.
        </p>
        {!pickerSupported && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
            בחירת אנשי קשר אוטומטית זמינה בעיקר ב-Chrome באנדרואיד. במכשירים אחרים אפשר
            להזין טלפון ידנית באותו מסך.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onStart}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            התחל סינכרון
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContactSyncWizard({
  guests,
  onSave,
  onClose,
}: {
  guests: Guest[];
  onSave: SaveContactFn;
  onClose: () => void;
}) {
  const [queue] = useState(() => guests.filter((g) => !g.phone?.trim()));
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const pickerSupported = isContactPickerSupported();

  const current = queue[index] ?? null;
  const done = queue.length === 0 || index >= queue.length;

  useEffect(() => {
    setManualPhone("");
    setManualName(current?.name ?? "");
    setError(null);
  }, [current?.id, current?.name]);

  async function applyContact(contact: PickedContact) {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(current.id, current.category_id, {
        phone: contact.phone || null,
        contact_name: contact.contactName || null,
      });
      setIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setBusy(false);
    }
  }

  async function openContacts() {
    setError(null);
    try {
      const picked = await pickContactFromDevice();
      if (!picked) return;
      await applyContact(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לפתוח אנשי קשר");
    }
  }

  async function saveManual() {
    const phone = manualPhone.trim();
    if (!phone) {
      setError("הזן מספר טלפון");
      return;
    }
    await applyContact({
      phone,
      contactName: manualName.trim() || current?.name || "",
    });
  }

  function skip() {
    setIndex((i) => i + 1);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="contacts-wizard-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-violet-100"
      >
        {done ? (
          <>
            <h2 id="contacts-wizard-title" className="text-lg font-bold text-slate-900">
              הסינכרון הושלם
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              המספרים נשמרו. בייצוא Excel יופיעו שם איש הקשר והטלפון.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              סגור
            </button>
          </>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 id="contacts-wizard-title" className="text-lg font-bold text-slate-900">
                קישור לאיש קשר
              </h2>
              <span className="text-xs font-semibold text-violet-600">
                {index + 1} / {queue.length}
              </span>
            </div>
            <p className="text-sm text-slate-500">חפשו באנשי הקשר ואשרו את המוזמן:</p>
            <p className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-center text-xl font-bold text-violet-800 ring-1 ring-violet-100">
              {current?.name}
            </p>

            {pickerSupported ? (
              <button
                type="button"
                onClick={openContacts}
                disabled={busy}
                className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
              >
                {busy ? "שומר..." : "פתח אנשי קשר"}
              </button>
            ) : (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
                <p className="font-semibold">אייפון / דפדפן זה לא מאפשרים לפתוח את אנשי הקשר מהאתר.</p>
                <p className="mt-1">הזיני את מספר הטלפון ידנית למטה (או פתחי ב-Chrome באנדרואיד לסינכרון אוטומטי).</p>
              </div>
            )}

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
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
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                type="button"
                onClick={saveManual}
                disabled={busy}
                className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                שמור מספר
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={skip}
                disabled={busy}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                דלג
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500"
              >
                עצור
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
