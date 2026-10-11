"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/tasks/scopes";

/**
 * כניסה קטנה ולא בולטת למערכת המשימות — לא "מציגה" משימות בדף הבית,
 * רק נותנת נקודת כניסה. מי שלא מחובר עדיין מתחיל התחברות עם Google;
 * מי שכבר מחובר מקבל קישור ישיר ל-/tasks.
 */
export function TasksEntryButton() {
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/tasks/me")
      .then((res) => res.json())
      .then((data: { profile: unknown }) => {
        if (active) setIsSignedIn(Boolean(data.profile));
      })
      .catch(() => {
        if (active) setIsSignedIn(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (isSignedIn === null) return null;

  if (isSignedIn) {
    return (
      <Link
        href="/tasks"
        className="fixed top-4 left-4 z-50 rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-blue-700 shadow-md ring-1 ring-blue-200 backdrop-blur-sm transition hover:bg-white"
      >
        משימות ←
      </Link>
    );
  }

  return (
    <button
      onClick={async () => {
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            scopes: GOOGLE_OAUTH_SCOPES,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
              include_granted_scopes: "true",
            },
            redirectTo: `${window.location.origin}/auth/callback?next=/tasks`,
          },
        });
      }}
      className="fixed top-4 left-4 z-50 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm transition hover:bg-white hover:text-slate-700"
    >
      התחברות
    </button>
  );
}
