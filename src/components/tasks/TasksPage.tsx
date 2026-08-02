"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackToHomeButton } from "@/components/checklist/BackToHomeButton";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/tasks/scopes";
import type { GoogleContactSummary, Task, TaskNotification, TaskProfile } from "@/lib/tasks/types";

type Filter = "all" | "assigned" | "created";

function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TasksPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [loadingSession, setLoadingSession] = useState(true);
  const [profile, setProfile] = useState<TaskProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<TaskProfile[]>([]);
  const [contacts, setContacts] = useState<GoogleContactSummary[]>([]);
  const [contactsMessage, setContactsMessage] = useState<string | null>(null);
  const [contactsQuery, setContactsQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/tasks/me");
    const data = (await res.json()) as { profile: TaskProfile | null };
    setProfile(data.profile);
    return data.profile;
  }, []);

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (!res.ok) return;
    const data = (await res.json()) as { tasks: Task[] };
    setTasks(data.tasks);
  }, []);

  const loadProfiles = useCallback(async () => {
    const res = await fetch("/api/tasks/profiles");
    if (!res.ok) return;
    const data = (await res.json()) as { profiles: TaskProfile[] };
    setProfiles(data.profiles);
  }, []);

  const loadContacts = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setContacts([]);
      setContactsMessage("הקלידו שם לחיפוש באנשי הקשר");
      return;
    }
    setLoadingContacts(true);
    try {
      const res = await fetch(`/api/tasks/contacts?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        contacts: GoogleContactSummary[];
        message?: string | null;
      };
      setContacts(data.contacts);
      setContactsMessage(data.message ?? null);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const res = await fetch("/api/tasks/notifications");
    if (!res.ok) return;
    const data = (await res.json()) as { notifications: TaskNotification[] };
    setNotifications(data.notifications);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const currentProfile = await loadProfile();
      if (active && currentProfile) {
        await Promise.all([loadTasks(), loadProfiles(), loadNotifications()]);
      }
      if (active) setLoadingSession(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
      const currentProfile = await loadProfile();
      if (currentProfile) {
        await Promise.all([loadTasks(), loadProfiles(), loadNotifications()]);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, loadProfile, loadTasks, loadProfiles, loadNotifications]);

  // פולינג קל להתראות ולמשימות כדי שדיווח "ביצעתי משימה" יגיע כמעט
  // באופן מיידי גם בלי שהמשתמש מרפרש את הדף (RLS חוסם Realtime מהדפדפן).
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => {
      loadNotifications();
      loadTasks();
    }, 15000);
    return () => clearInterval(interval);
  }, [profile, loadNotifications, loadTasks]);

  const signIn = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: GOOGLE_OAUTH_SCOPES,
        queryParams: { access_type: "offline", prompt: "consent" },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setTasks([]);
  }, [supabase]);

  const createTask = useCallback(async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          assigned_to: newAssignee || null,
          due_at: newDueAt ? new Date(newDueAt).toISOString() : null,
        }),
      });
      const data = (await res.json()) as { calendarWarning?: string | null; error?: string };
      if (!res.ok) {
        setBanner(data.error ?? "שגיאה ביצירת משימה");
        return;
      }
      setBanner(data.calendarWarning ?? "המשימה נוצרה בהצלחה");
      setNewTitle("");
      setNewDescription("");
      setNewAssignee("");
      setNewDueAt("");
      setShowNewTask(false);
      await loadTasks();
    } finally {
      setSaving(false);
    }
  }, [newTitle, newDescription, newAssignee, newDueAt, loadTasks]);

  const completeTask = useCallback(
    async (taskId: string) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done", completion_summary: completionSummary.trim() || null }),
        });
        const data = (await res.json()) as { calendarWarning?: string | null; error?: string };
        if (!res.ok) {
          setBanner(data.error ?? "שגיאה בסימון המשימה כבוצעה");
          return;
        }
        setCompletingTaskId(null);
        setCompletionSummary("");
        await loadTasks();
      } finally {
        setSaving(false);
      }
    },
    [completionSummary, loadTasks],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!confirm("למחוק את המשימה?")) return;
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      await loadTasks();
    },
    [loadTasks],
  );

  const markNotificationsRead = useCallback(
    async (ids: string[]) => {
      await fetch("/api/tasks/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      await loadNotifications();
    },
    [loadNotifications],
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredTasks = tasks.filter((task) => {
    if (filter === "assigned") return task.assigned_to === profile?.id;
    if (filter === "created") return task.created_by === profile?.id;
    return true;
  });

  if (loadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">טוען…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50">
        <BackToHomeButton accent="blue" />
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
          <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-blue-100">
            <h1 className="text-3xl font-bold text-slate-900">משימות</h1>
            <p className="mt-3 text-slate-600">
              ניהול משימות עם הקצאה לאנשי קשר, תזכורות אוטומטיות ביומן Google, והתראות כשמשימה
              מסתיימת — מסונכרן לכל מכשיר (iPhone, Android, וכל מכשיר עם יומן Google).
            </p>
            <button
              onClick={signIn}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-md transition hover:bg-blue-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path
                  fill="#fff"
                  d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.344-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
                />
              </svg>
              התחברות עם Google
            </button>
            <p className="mt-4 text-xs text-slate-400">
              בהתחברות תתבקשו לאשר גישה ליומן ולאנשי הקשר שלכם — כדי שנוכל להקצות לכם משימות עם
              תזכורת אוטומטית.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <BackToHomeButton accent="blue" />

      <header className="bg-gradient-to-l from-blue-600 to-indigo-600 px-4 py-8 text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">משימות</h1>
            <p className="mt-1 text-sm text-blue-100">
              מחובר/ת כ-{profile.full_name ?? profile.email}
              {!profile.has_google_calendar && " — Google Calendar לא מחובר"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="relative rounded-xl bg-white/15 p-2.5 transition hover:bg-white/25"
              aria-label="התראות"
            >
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM8.5 16a1.5 1.5 0 003 0h-3z" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={signOut}
              className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold transition hover:bg-white/25"
            >
              התנתקות
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {showNotifications && (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">התראות</h2>
              {unreadCount > 0 && (
                <button
                  onClick={() => markNotificationsRead(notifications.filter((n) => !n.is_read).map((n) => n.id))}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  סמן הכל כנקרא
                </button>
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {notifications.length === 0 && <li className="text-sm text-slate-400">אין התראות</li>}
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.is_read && markNotificationsRead([n.id])}
                  className={`cursor-pointer rounded-xl p-3 text-sm ${
                    n.is_read ? "bg-slate-50 text-slate-500" : "bg-blue-50 font-semibold text-slate-800"
                  }`}
                >
                  {n.message}
                  <div className="mt-1 text-xs font-normal text-slate-400">
                    {formatDueDate(n.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {banner && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            <span>{banner}</span>
            <button onClick={() => setBanner(null)} className="font-bold">
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(
              [
                ["all", "הכל"],
                ["assigned", "מוקצות לי"],
                ["created", "שיצרתי"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === key ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNewTask((v) => !v)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-blue-700"
          >
            {showNewTask ? "ביטול" : "+ משימה חדשה"}
          </button>
        </div>

        {showNewTask && (
          <div className="mt-4 space-y-3 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="כותרת המשימה"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="תיאור (אופציונלי)"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="">ללא הקצאה</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email} {p.has_google_calendar ? "" : "(ללא יומן מחובר)"}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={newDueAt}
                onChange={(e) => setNewDueAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">
              אפשר להקצות רק למי שכבר התחבר/ה למערכת המשימות עם Google. רשימת אנשי הקשר שלכם
              (מטה) היא רק לעיון — כדי לשלוח למישהו תזכורת ביומן, בקשו ממנו/ה להתחבר לעמוד הזה
              פעם אחת.
            </p>
            <button
              onClick={createTask}
              disabled={saving || !newTitle.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "שומר…" : "יצירת משימה"}
            </button>
          </div>
        )}

        <button
          onClick={() => setShowContacts((v) => !v)}
          className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
        >
          {showContacts ? "הסתרת אנשי קשר" : "הצגת אנשי הקשר שלי מ-Google"}
        </button>

        {showContacts && (
          <div className="mt-3 rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200">
            <div className="mb-3 flex gap-2">
              <input
                type="search"
                value={contactsQuery}
                onChange={(e) => setContactsQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadContacts(contactsQuery);
                }}
                placeholder="חיפוש באנשי קשר Google..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                type="button"
                onClick={() => void loadContacts(contactsQuery)}
                disabled={loadingContacts}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loadingContacts ? "..." : "חפש"}
              </button>
            </div>
            {contactsMessage && <p className="text-sm text-amber-700">{contactsMessage}</p>}
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {contacts.map((c) => (
                <li key={c.resourceName} className="flex justify-between border-b border-slate-100 py-1.5">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="text-slate-400">{c.email ?? c.phone ?? ""}</span>
                </li>
              ))}
              {contacts.length === 0 && !contactsMessage && (
                <li className="text-slate-400">הקלידו שם ולחצו חפש</li>
              )}
            </ul>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {filteredTasks.length === 0 && (
            <li className="rounded-2xl bg-white p-8 text-center text-slate-400 shadow ring-1 ring-slate-200">
              אין משימות להצגה
            </li>
          )}
          {filteredTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const isDone = task.status === "done";
            return (
              <li key={task.id} className="overflow-hidden rounded-2xl bg-white shadow ring-1 ring-slate-200">
                <button
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${isDone ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    <span className={`font-semibold ${isDone ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {task.title}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{formatDueDate(task.due_at)}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
                    {task.description && <p className="mb-3">{task.description}</p>}
                    <div className="grid gap-1 text-xs text-slate-400">
                      <span>יוצר/ת: {task.created_by_profile?.full_name ?? task.created_by_profile?.email}</span>
                      <span>
                        אחראי/ת: {task.assigned_to_profile?.full_name ?? task.assigned_to_profile?.email ?? "ללא הקצאה"}
                      </span>
                      {task.due_at && <span>תזכורת: {formatDueDate(task.due_at)}</span>}
                      {task.completion_summary && <span>סיכום: {task.completion_summary}</span>}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!isDone && (
                        <button
                          onClick={() => setCompletingTaskId(task.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          ביצעתי משימה
                        </button>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                      >
                        מחיקה
                      </button>
                    </div>

                    {completingTaskId === task.id && (
                      <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                        <label className="block text-xs font-semibold text-slate-500">מה נעשה?</label>
                        <textarea
                          value={completionSummary}
                          onChange={(e) => setCompletionSummary(e.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="תיאור קצר של מה שבוצע"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => completeTask(task.id)}
                            disabled={saving}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                          >
                            שליחה
                          </button>
                          <button
                            onClick={() => setCompletingTaskId(null)}
                            className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
