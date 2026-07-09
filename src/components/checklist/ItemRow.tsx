"use client";

import type { ChecklistAccent, ChecklistItem } from "@/lib/checklist/types";
import { useEffect, useState } from "react";

const accentStyles = {
  rose: { checkbox: "accent-rose-600", checked: "bg-rose-50/60" },
  emerald: { checkbox: "accent-emerald-600", checked: "bg-emerald-50/60" },
  amber: { checkbox: "accent-amber-600", checked: "bg-amber-50/60" },
} as const;

interface ItemRowProps {
  item: ChecklistItem;
  accent: ChecklistAccent;
  onUpdate: (
    id: string,
    patch: Partial<Pick<ChecklistItem, "is_checked" | "price" | "item_name">>,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function formatPrice(value: number): string {
  return value > 0 ? String(value) : "";
}

export function ItemRow({ item, accent, onUpdate, onDelete }: ItemRowProps) {
  const styles = accentStyles[accent];
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.item_name);
  const [priceDraft, setPriceDraft] = useState(formatPrice(item.price));
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!editing) setNameDraft(item.item_name);
  }, [item.item_name, editing]);

  useEffect(() => {
    setPriceDraft(formatPrice(item.price));
  }, [item.price]);

  function savePrice() {
    const trimmed = priceDraft.trim();
    const nextPrice = trimmed === "" ? 0 : Number(trimmed);
    if (Number.isNaN(nextPrice) || nextPrice < 0) {
      setPriceDraft(formatPrice(item.price));
      return;
    }
    if (nextPrice !== item.price) {
      onUpdate(item.id, { price: nextPrice });
    }
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameDraft(item.item_name);
      setEditing(false);
      return;
    }
    if (trimmed !== item.item_name) {
      await onUpdate(item.id, { item_name: trimmed });
    }
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`למחוק את "${item.item_name}"?`)) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition sm:gap-3 ${
        item.is_checked ? styles.checked : "hover:bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        checked={item.is_checked}
        onChange={(e) => onUpdate(item.id, { is_checked: e.target.checked })}
        className={`h-5 w-5 shrink-0 cursor-pointer rounded ${styles.checkbox}`}
        aria-label={`סמן ${item.item_name} כבוצע`}
      />

      {editing ? (
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveName();
            if (e.key === "Escape") {
              setNameDraft(item.item_name);
              setEditing(false);
            }
          }}
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNameDraft(item.item_name);
            setEditing(true);
          }}
          title="לחץ לעריכה"
          className={`min-w-0 flex-1 text-right text-sm ${
            item.is_checked ? "text-slate-400 line-through" : "text-slate-800"
          }`}
        >
          {item.item_name}
        </button>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <span className="text-xs text-slate-400">₪</span>
        <input
          type="number"
          min="0"
          step="1"
          value={priceDraft}
          placeholder="אופציונלי"
          onChange={(e) => setPriceDraft(e.target.value)}
          onBlur={savePrice}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-left text-sm outline-none focus:ring-2 focus:ring-slate-200"
          aria-label={`מחיר ${item.item_name} (אופציונלי)`}
        />
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        title="מחק שורה"
        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        aria-label={`מחק ${item.item_name}`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.592.176-2.391.296a.75.75 0 00-.584.804l.063 1.062A48.998 48.998 0 014 12.01v.045c0 2.257 1.282 4.312 3.301 5.308a48.01 48.01 0 0012.002 0c2.019-.996 3.301-3.051 3.301-5.308v-.045a48.998 48.998 0 00-3.324-1.406l.063-1.062a.75.75 0 00-.584-.804 48.59 48.59 0 00-2.391-.296V3.75A2.75 2.75 0 0011.25 1h-2.5zM9.5 4.5v-.257a1.25 1.25 0 011.25-1.25h2.5a1.25 1.25 0 011.25 1.25V4.5h-5zm1.25 6.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm3.75 0a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </li>
  );
}
