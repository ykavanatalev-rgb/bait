"use client";

import { calcBudgetSummary } from "@/lib/checklist/csv";
import type { ChecklistAccent } from "@/lib/checklist/types";

type Summary = ReturnType<typeof calcBudgetSummary>;

const accentStyles = {
  rose: {
    bar: "from-rose-500 to-pink-500",
    ring: "ring-rose-100",
    label: "text-rose-700",
  },
  emerald: {
    bar: "from-emerald-500 to-teal-500",
    ring: "ring-emerald-100",
    label: "text-emerald-700",
  },
  amber: {
    bar: "from-amber-500 to-orange-500",
    ring: "ring-amber-100",
    label: "text-amber-700",
  },
} as const;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface BudgetSummaryProps {
  summary: Summary;
  accent: ChecklistAccent;
}

export function BudgetSummary({ summary, accent }: BudgetSummaryProps) {
  const styles = accentStyles[accent];
  const progress =
    summary.totalEstimated > 0
      ? Math.min(100, (summary.totalChecked / summary.totalEstimated) * 100)
      : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className={`mx-auto max-w-3xl px-4 py-4 ring-1 ${styles.ring}`}>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-l ${styles.bar} transition-all duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">סך עלות משוערת</p>
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(summary.totalEstimated)}
            </p>
          </div>
          <div className="text-left">
            <p className={`text-xs ${styles.label}`}>סומן כבוצע (V)</p>
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(summary.totalChecked)}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-500">נותר</p>
            <p className="text-lg font-semibold text-slate-700">
              {formatCurrency(summary.totalEstimated - summary.totalChecked)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
