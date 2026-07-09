"use client";

import type { ChecklistAccent, ChecklistItem } from "@/lib/checklist/types";
import { ItemRow } from "./ItemRow";
import { useState } from "react";

const accentStyles = {
  rose: {
    card: "ring-rose-100",
    title: "text-rose-900",
    button: "bg-rose-600 hover:bg-rose-700",
    input: "focus:ring-rose-300",
    editBtn: "text-rose-600 hover:bg-rose-50",
    deleteBtn: "text-red-600 hover:bg-red-50",
  },
  emerald: {
    card: "ring-emerald-100",
    title: "text-emerald-900",
    button: "bg-emerald-600 hover:bg-emerald-700",
    input: "focus:ring-emerald-300",
    editBtn: "text-emerald-600 hover:bg-emerald-50",
    deleteBtn: "text-red-600 hover:bg-red-50",
  },
  amber: {
    card: "ring-amber-100",
    title: "text-amber-900",
    button: "bg-amber-600 hover:bg-amber-700",
    input: "focus:ring-amber-300",
    editBtn: "text-amber-600 hover:bg-amber-50",
    deleteBtn: "text-red-600 hover:bg-red-50",
  },
} as const;

interface SubCategorySectionProps {
  subCategory: string;
  items: ChecklistItem[];
  accent: ChecklistAccent;
  onUpdate: (
    id: string,
    patch: Partial<Pick<ChecklistItem, "is_checked" | "price" | "item_name">>,
  ) => Promise<void>;
  onAdd: (sub_category: string, item_name: string, price: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onRenameSubCategory: (oldName: string, newName: string) => Promise<void>;
  onDeleteSubCategory: (subCategory: string) => Promise<void>;
}

export function SubCategorySection({
  subCategory,
  items,
  accent,
  onUpdate,
  onAdd,
  onDeleteItem,
  onRenameSubCategory,
  onDeleteSubCategory,
}: SubCategorySectionProps) {
  const styles = accentStyles[accent];
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subCategory);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await onAdd(subCategory, newName.trim(), Number(newPrice) || 0);
      setNewName("");
      setNewPrice("");
    } finally {
      setAdding(false);
    }
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(subCategory);
      setEditingTitle(false);
      return;
    }
    if (trimmed !== subCategory) {
      setBusy(true);
      try {
        await onRenameSubCategory(subCategory, trimmed);
      } finally {
        setBusy(false);
      }
    }
    setEditingTitle(false);
  }

  async function handleDeleteCategory() {
    const msg =
      items.length > 0
        ? `למחוק את הקטגוריה "${subCategory}" ו-${items.length} פריטים?`
        : `למחוק את הקטגוריה "${subCategory}"?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await onDeleteSubCategory(subCategory);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${styles.card}`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        {editingTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitleDraft(subCategory);
                setEditingTitle(false);
              }
            }}
            autoFocus
            disabled={busy}
            className={`min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-lg font-bold outline-none focus:ring-2 ${styles.input}`}
          />
        ) : (
          <h2 className={`text-lg font-bold ${styles.title}`}>{subCategory}</h2>
        )}

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => {
              setTitleDraft(subCategory);
              setEditingTitle(true);
            }}
            disabled={busy}
            title="ערוך שם קטגוריה"
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${styles.editBtn}`}
          >
            ✏️ ערוך
          </button>
          <button
            type="button"
            onClick={handleDeleteCategory}
            disabled={busy}
            title="מחק קטגוריה"
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${styles.deleteBtn}`}
          >
            🗑 מחק
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            accent={accent}
            onUpdate={onUpdate}
            onDelete={onDeleteItem}
          />
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-400">אין פריטים — הוסף למטה</li>
        )}
      </ul>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="שם פריט חדש..."
          className={`min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 ${styles.input}`}
        />
        <input
          type="number"
          min="0"
          step="1"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          placeholder="מחיר — אופציונלי"
          className={`w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 ${styles.input}`}
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40 ${styles.button}`}
        >
          + הוסף פריט
        </button>
      </form>
    </section>
  );
}
