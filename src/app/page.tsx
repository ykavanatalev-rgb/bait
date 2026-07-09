import Link from "next/link";
import { TasksEntryButton } from "@/components/tasks/TasksEntryButton";

const categories = [
  {
    href: "/guests",
    title: "רשימת מוזמנים",
    description: "רישום שמות, חיפוש לפי שם וייצוא",
    gradient: "from-violet-400 via-purple-500 to-violet-600",
    ring: "ring-violet-200 hover:ring-violet-300",
    icon: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden>
        <circle cx="32" cy="20" r="8" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M14 52c0-10 8-16 18-16s18 6 18 16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="48" cy="24" r="6" stroke="currentColor" strokeWidth="2" opacity="0.7" />
        <path
          d="M42 44c2-4 6-6 10-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    ),
  },
  {
    href: "/wedding",
    title: "חתונה",
    description: "רשימת משימות ותקציב מלאה לחתונה — מא׳ ועד ת׳",
    gradient: "from-rose-400 via-pink-500 to-rose-600",
    ring: "ring-rose-200 hover:ring-rose-300",
    icon: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden>
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <path
          d="M22 38c0-5.5 4.5-10 10-10s10 4.5 10 10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="26" cy="24" r="5" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="38" cy="24" r="5" stroke="currentColor" strokeWidth="2.5" />
        <path d="M32 14v6M28 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/henna",
    title: "חינה",
    description: "משימות ותקציב לאירוע החינה — מקום, לבוש, ספקים ועוד",
    gradient: "from-amber-400 via-orange-500 to-amber-600",
    ring: "ring-amber-200 hover:ring-amber-300",
    icon: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden>
        <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path
          d="M20 36c4-8 8-12 12-12s8 4 12 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M26 28c2-4 4-6 6-6s4 2 6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="32" cy="22" r="4" stroke="currentColor" strokeWidth="2" />
        <path
          d="M16 44c6 4 12 6 16 6s10-2 16-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    ),
  },
  {
    href: "/home",
    title: "בית",
    description: "ציוד וריהוט לכל חדר — מטבח, סלון, שינה ועוד",
    gradient: "from-emerald-400 via-teal-500 to-emerald-600",
    ring: "ring-emerald-200 hover:ring-emerald-300",
    icon: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden>
        <path
          d="M8 30L32 12l24 18v22a2 2 0 01-2 2H10a2 2 0 01-2-2V30z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <rect x="24" y="36" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="2.5" />
        <path d="M32 12v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-50 px-4 py-12">
      <TasksEntryButton />
      <div className="mb-10 text-center">
        <p className="text-sm font-medium text-slate-500">ניהול משימות ותקציב</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900">Bait</h1>
        <p className="mt-2 text-slate-600">בחר קטגוריה להתחיל</p>
      </div>

      <div className="grid w-full max-w-4xl gap-5 sm:grid-cols-2">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className={`group relative overflow-hidden rounded-3xl bg-white p-8 shadow-lg ring-2 transition hover:-translate-y-1 hover:shadow-xl ${cat.ring}`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-0 transition group-hover:opacity-5`}
            />
            <div
              className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 text-white shadow-md`}
            >
              {cat.icon}
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{cat.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{cat.description}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 transition-all group-hover:gap-2">
              כניסה לרשימה ←
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
