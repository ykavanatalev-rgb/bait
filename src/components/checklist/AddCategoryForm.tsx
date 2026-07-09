"use client";

import type { ChecklistAccent } from "@/lib/checklist/types";
import { useState } from "react";

const accentStyles = {
  rose: {
    wrap: "ring-rose-100",
    button: "bg-rose-600 hover:bg-rose-700",
    input: "focus:ring-rose-300",
  },
  emerald: {
    wrap: "ring-emerald-100",
    button: "bg-emerald-600 hover:bg-emerald-700",
    input: "focus:ring-emerald-300",
  },
  amber: {
    wrap: "ring-amber-100",
    button: "bg-amber-600 hover:bg-amber-700",
    input: "focus:ring-amber-300",
  },
} as const;

interface AddCategoryFormProps {
  accent: ChecklistAccent;
  onAdd: (subCategory: string, itemName: string, price: number) => Promise<void>;
}

export function AddCategoryForm({ accent, onAdd }: AddCategoryFormProps) {
  const styles = accentStyles[accent];
  const [open, setOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cat = categoryName.trim();
    const item = itemName.trim();
    if (!cat || !item) return;

    setSaving(true);
    try {
      await onAdd(cat, item, Number(price) || 0);
      setCategoryName("");
      setItemName("");
      setPrice("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white ${styles.wrap}`}
      >
        + קטגוריה חדשה
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${styles.wrap}`}
    >
      <h3 className="mb-3 font-bold text-slate-800">קטגוריה חדשה</h3>
      <div className="space-y-2">
        <input
          type="text"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="שם הקטגוריה (למשל: גינה)"
          className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 ${styles.input}`}
          autoFocus
        />
        <input
          type="text"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="פריט ראשון בקטגוריה"
          className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 ${styles.input}`}
        />
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="מחיר (₪) — אופציונלי"
          className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 ${styles.input}`}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={saving || !categoryName.trim() || !itemName.trim()}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${styles.button}`}
        >
          שמור קטגוריה
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
