"use client";

import type { ChecklistItem, ChecklistPageConfig } from "@/lib/checklist/types";
import { calcBudgetSummary, exportChecklistToCsv } from "@/lib/checklist/csv";
import { getOrderedSubCategories } from "@/lib/checklist/grouping";
import { openWhatsAppReport } from "@/lib/checklist/whatsapp";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BudgetSummary } from "./BudgetSummary";
import { BackToHomeButton } from "./BackToHomeButton";
import { SubCategorySection } from "./SubCategorySection";
import { AddCategoryForm } from "./AddCategoryForm";

const accentStyles = {
  rose: {
    header: "from-rose-500 to-pink-600",
    tabActive: "bg-rose-600 text-white shadow-md",
    tabIdle: "bg-white text-rose-700 ring-1 ring-rose-100 hover:bg-rose-50",
    export: "ring-rose-200 text-rose-700 hover:bg-rose-50",
    whatsapp: "bg-green-600 text-white hover:bg-green-700",
  },
  emerald: {
    header: "from-emerald-500 to-teal-600",
    tabActive: "bg-emerald-600 text-white shadow-md",
    tabIdle: "bg-white text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-50",
    export: "ring-emerald-200 text-emerald-700 hover:bg-emerald-50",
    whatsapp: "bg-green-600 text-white hover:bg-green-700",
  },
  amber: {
    header: "from-amber-500 to-orange-600",
    tabActive: "bg-amber-600 text-white shadow-md",
    tabIdle: "bg-white text-amber-700 ring-1 ring-amber-100 hover:bg-amber-50",
    export: "ring-amber-200 text-amber-700 hover:bg-amber-50",
    whatsapp: "bg-green-600 text-white hover:bg-green-700",
  },
} as const;

interface ChecklistPageProps {
  config: ChecklistPageConfig;
  useTabs?: boolean;
}

export function ChecklistPage({ config, useTabs = false }: ChecklistPageProps) {
  const styles = accentStyles[config.accent];
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/checklist?category=${config.category}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינה");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, [config.category]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const allSubCategories = useMemo(() => getOrderedSubCategories(items), [items]);

  useEffect(() => {
    if (allSubCategories.length === 0) {
      setActiveTab("");
      return;
    }
    if (!activeTab || !allSubCategories.includes(activeTab)) {
      setActiveTab(allSubCategories[0]);
    }
  }, [allSubCategories, activeTab]);

  const updateItem = useCallback(
    async (id: string, patch: Partial<Pick<ChecklistItem, "is_checked" | "price" | "item_name">>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );

      try {
        const res = await fetch(`/api/checklist/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "שגיאה בעדכון");
        }
      } catch {
        await loadItems();
      }
    },
    [loadItems],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      try {
        const res = await fetch(`/api/checklist/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "שגיאה במחיקה");
        }
      } catch {
        await loadItems();
      }
    },
    [loadItems],
  );

  const addItem = useCallback(
    async (sub_category: string, item_name: string, price: number) => {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: config.category,
          sub_category,
          item_name,
          price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בהוספה");
      setItems((prev) => [...prev, data.item]);
      if (useTabs) setActiveTab(sub_category);
    },
    [config.category, useTabs],
  );

  const renameSubCategory = useCallback(
    async (oldName: string, newName: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.sub_category === oldName ? { ...item, sub_category: newName } : item,
        ),
      );
      if (activeTab === oldName) setActiveTab(newName);

      try {
        const res = await fetch("/api/checklist/subcategory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: config.category,
            old_name: oldName,
            new_name: newName,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "שגיאה בשינוי שם");
        }
      } catch {
        await loadItems();
      }
    },
    [config.category, activeTab, loadItems],
  );

  const deleteSubCategory = useCallback(
    async (subCategory: string) => {
      setItems((prev) => prev.filter((item) => item.sub_category !== subCategory));

      try {
        const res = await fetch("/api/checklist/subcategory", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: config.category,
            sub_category: subCategory,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "שגיאה במחיקה");
        }
      } catch {
        await loadItems();
      }
    },
    [config.category, loadItems],
  );

  const visibleSubCategories = useMemo(() => {
    if (useTabs && activeTab) return [activeTab];
    return allSubCategories;
  }, [useTabs, activeTab, allSubCategories]);

  const summary = calcBudgetSummary(items);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-32">
      <BackToHomeButton accent={config.accent} />

      <header className={`bg-gradient-to-l ${styles.header} px-4 py-8 text-white shadow-lg`}>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">{config.title}</h1>
          <p className="mt-1 text-white/85">{config.subtitle}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {summary.checkedCount} מתוך {summary.totalCount} פריטים סומנו
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openWhatsAppReport(items, config.title)}
              disabled={items.length === 0}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${styles.whatsapp}`}
            >
              📱 שלח לוואטסאפ
            </button>
            <button
              type="button"
              onClick={() => exportChecklistToCsv(items, config.category, config.title)}
              disabled={items.length === 0}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition disabled:opacity-40 ${styles.export}`}
            >
              ↓ ייצוא Excel
            </button>
          </div>
        </div>

        {useTabs && allSubCategories.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {allSubCategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setActiveTab(sub)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === sub ? styles.tabActive : styles.tabIdle
                }`}
              >
                {sub.replace("מטבח · ", "")}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-100">
            טוען רשימה...
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 p-6 text-center text-red-700 ring-1 ring-red-100">
            <p>{error}</p>
            <button
              type="button"
              onClick={loadItems}
              className="mt-3 text-sm font-semibold underline"
            >
              נסה שוב
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {visibleSubCategories.map((subCategory) => (
              <SubCategorySection
                key={subCategory}
                subCategory={subCategory}
                items={items.filter((item) => item.sub_category === subCategory)}
                accent={config.accent}
                onUpdate={updateItem}
                onAdd={addItem}
                onDeleteItem={deleteItem}
                onRenameSubCategory={renameSubCategory}
                onDeleteSubCategory={deleteSubCategory}
              />
            ))}

            <AddCategoryForm accent={config.accent} onAdd={addItem} />
          </div>
        )}
      </div>

      {!loading && !error && items.length > 0 && (
        <BudgetSummary summary={summary} accent={config.accent} />
      )}
    </div>
  );
}
