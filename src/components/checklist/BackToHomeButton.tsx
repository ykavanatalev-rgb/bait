import Link from "next/link";

import type { ChecklistAccent } from "@/lib/checklist/types";

interface BackToHomeButtonProps {
  accent: ChecklistAccent | "violet" | "blue";
}

const styles = {
  rose: "bg-white text-rose-700 ring-rose-200 hover:bg-rose-50",
  emerald: "bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50",
  amber: "bg-white text-amber-700 ring-amber-200 hover:bg-amber-50",
  violet: "bg-white text-violet-700 ring-violet-200 hover:bg-violet-50",
  blue: "bg-white text-blue-700 ring-blue-200 hover:bg-blue-50",
} as const;

export function BackToHomeButton({ accent }: BackToHomeButtonProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ring-1 shadow-sm transition hover:shadow ${styles[accent]}`}
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          חזרה לתפריט הבית
        </Link>
      </div>
    </div>
  );
}
