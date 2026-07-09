"use client";

import { useCallback, useEffect, useState } from "react";
import { BackToHomeButton } from "@/components/checklist/BackToHomeButton";
import type { InfrastructureProject } from "@/lib/infrastructure/types";

const DATABASE_OPTIONS = [
  { value: "", label: "בחר..." },
  { value: "supabase", label: "Supabase" },
  { value: "firebase", label: "Firebase" },
  { value: "postgres", label: "Postgres" },
  { value: "other", label: "אחר" },
];

const HOSTING_OPTIONS = [
  { value: "", label: "בחר..." },
  { value: "vercel", label: "Vercel" },
  { value: "render", label: "Render" },
  { value: "aws", label: "AWS" },
  { value: "other", label: "אחר" },
];

interface DraftProject {
  project_name: string;
  database_provider: string;
  database_details: string;
  hosting_provider: string;
  hosting_details: string;
  repo_url: string;
  repo_account: string;
  notes: string;
}

const emptyDraft: DraftProject = {
  project_name: "",
  database_provider: "",
  database_details: "",
  hosting_provider: "",
  hosting_details: "",
  repo_url: "",
  repo_account: "",
  notes: "",
};

function toDraft(project: InfrastructureProject): DraftProject {
  return {
    project_name: project.project_name,
    database_provider: project.database_provider ?? "",
    database_details: project.database_details ?? "",
    hosting_provider: project.hosting_provider ?? "",
    hosting_details: project.hosting_details ?? "",
    repo_url: project.repo_url ?? "",
    repo_account: project.repo_account ?? "",
    notes: project.notes ?? "",
  };
}

function providerLabel(options: typeof DATABASE_OPTIONS, value: string | null) {
  return options.find((o) => o.value === value)?.label ?? "—";
}

export function InfrastructureDashboard() {
  const [projects, setProjects] = useState<InfrastructureProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftProject>(emptyDraft);
  const [showNew, setShowNew] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftProject>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/infrastructure");
    if (res.ok) {
      const data = (await res.json()) as { projects: InfrastructureProject[] };
      setProjects(data.projects);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (project: InfrastructureProject) => {
    setEditingId(project.id);
    setDraft(toDraft(project));
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/infrastructure/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("למחוק את הפרויקט מהרשימה?")) return;
    await fetch(`/api/infrastructure/${id}`, { method: "DELETE" });
    await load();
  };

  const createProject = async () => {
    if (!newDraft.project_name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/infrastructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDraft),
      });
      setNewDraft(emptyDraft);
      setShowNew(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <BackToHomeButton accent="blue" />

      <header className="bg-gradient-to-l from-slate-800 to-slate-900 px-4 py-8 text-white shadow-lg">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold">ניהול תשתיות (DevOps Tracker)</h1>
          <p className="mt-1 text-sm text-slate-300">
            תיעוד מרוכז של הפרויקטים שפיתחנו — Database, Hosting ו-Repository
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <button
          onClick={() => setShowNew((v) => !v)}
          className="mb-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-slate-900"
        >
          {showNew ? "ביטול" : "+ פרויקט חדש"}
        </button>

        {showNew && (
          <div className="mb-6 grid gap-3 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 sm:grid-cols-2">
            <input
              value={newDraft.project_name}
              onChange={(e) => setNewDraft({ ...newDraft, project_name: e.target.value })}
              placeholder="שם הפרויקט"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm sm:col-span-2"
            />
            <div>
              <select
                value={newDraft.database_provider}
                onChange={(e) => setNewDraft({ ...newDraft, database_provider: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                {DATABASE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {newDraft.database_provider && (
                <input
                  value={newDraft.database_details}
                  onChange={(e) => setNewDraft({ ...newDraft, database_details: e.target.value })}
                  placeholder="פרטי חשבון / הפניה (לא לשמור סוד גלוי)"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                />
              )}
            </div>
            <div>
              <select
                value={newDraft.hosting_provider}
                onChange={(e) => setNewDraft({ ...newDraft, hosting_provider: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                {HOSTING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {newDraft.hosting_provider && (
                <input
                  value={newDraft.hosting_details}
                  onChange={(e) => setNewDraft({ ...newDraft, hosting_details: e.target.value })}
                  placeholder="שם הפרויקט / חשבון ב-Hosting"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                />
              )}
            </div>
            <input
              value={newDraft.repo_url}
              onChange={(e) => setNewDraft({ ...newDraft, repo_url: e.target.value })}
              placeholder="קישור ל-GitHub repo"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <input
              value={newDraft.repo_account}
              onChange={(e) => setNewDraft({ ...newDraft, repo_account: e.target.value })}
              placeholder="שם חשבון GitHub"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <textarea
              value={newDraft.notes}
              onChange={(e) => setNewDraft({ ...newDraft, notes: e.target.value })}
              placeholder="הערות (אופציונלי)"
              rows={2}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm sm:col-span-2"
            />
            <button
              onClick={createProject}
              disabled={saving || !newDraft.project_name.trim()}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-slate-900 disabled:opacity-50 sm:col-span-2 sm:w-fit"
            >
              {saving ? "שומר…" : "שמירה"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">טוען…</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow ring-1 ring-slate-200">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-4 py-3">פרויקט</th>
                  <th className="px-4 py-3">Database</th>
                  <th className="px-4 py-3">Hosting</th>
                  <th className="px-4 py-3">Repository</th>
                  <th className="px-4 py-3">הערות</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((project) => {
                  const isEditing = editingId === project.id;
                  if (isEditing) {
                    return (
                      <tr key={project.id} className="bg-blue-50/40 align-top">
                        <td className="px-4 py-3">
                          <input
                            value={draft.project_name}
                            onChange={(e) => setDraft({ ...draft, project_name: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.database_provider}
                            onChange={(e) => setDraft({ ...draft, database_provider: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          >
                            {DATABASE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {draft.database_provider && (
                            <input
                              value={draft.database_details}
                              onChange={(e) => setDraft({ ...draft, database_details: e.target.value })}
                              placeholder="פרטי חשבון"
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.hosting_provider}
                            onChange={(e) => setDraft({ ...draft, hosting_provider: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          >
                            {HOSTING_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {draft.hosting_provider && (
                            <input
                              value={draft.hosting_details}
                              onChange={(e) => setDraft({ ...draft, hosting_details: e.target.value })}
                              placeholder="שם פרויקט/חשבון"
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={draft.repo_url}
                            onChange={(e) => setDraft({ ...draft, repo_url: e.target.value })}
                            placeholder="קישור repo"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={draft.repo_account}
                            onChange={(e) => setDraft({ ...draft, repo_account: e.target.value })}
                            placeholder="חשבון GitHub"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            value={draft.notes}
                            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => saveEdit(project.id)}
                              disabled={saving}
                              className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white"
                            >
                              שמירה
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600"
                            >
                              ביטול
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={project.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">{project.project_name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-semibold">
                          {providerLabel(DATABASE_OPTIONS, project.database_provider)}
                        </div>
                        {project.database_details && (
                          <div className="text-xs text-slate-400">{project.database_details}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-semibold">
                          {providerLabel(HOSTING_OPTIONS, project.hosting_provider)}
                        </div>
                        {project.hosting_details && (
                          <div className="text-xs text-slate-400">{project.hosting_details}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {project.repo_url && (
                          <a
                            href={project.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {project.repo_account ?? project.repo_url}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{project.notes}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => startEdit(project)}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                          >
                            עריכה
                          </button>
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100"
                          >
                            מחיקה
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      אין פרויקטים עדיין
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          מומלץ לא לשמור כאן מפתחות/סיסמאות מלאים בטקסט גלוי — מוטב לשמור הפניה (למשל "ראו
          מנהל הסיסמאות, רשומת Bait Supabase") ולא את הערך הרגיש עצמו.
        </p>
      </div>
    </main>
  );
}
