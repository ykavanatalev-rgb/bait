"use client";

import type { Guest, GuestCategoryWithGuests } from "@/lib/guests/types";
import { openGuestsWhatsAppReport } from "@/lib/guests/export";
import { BackToHomeButton } from "@/components/checklist/BackToHomeButton";
import { GuestContactLinker } from "@/components/guests/ContactSync";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/tasks/scopes";
import { useCallback, useEffect, useMemo, useState } from "react";

type GuestWithCategory = Guest & { categoryName: string };

type LinkingState = {
  guest: Guest;
  categoryName: string;
  queue: Guest[];
  index: number;
};

export function GuestListPage() {
  const [categories, setCategories] = useState<GuestCategoryWithGuests[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [linking, setLinking] = useState<LinkingState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  const totalGuests = useMemo(
    () => categories.reduce((sum, c) => sum + c.guests.length, 0),
    [categories],
  );

  const allGuests = useMemo<GuestWithCategory[]>(
    () =>
      categories.flatMap((c) =>
        c.guests.map((g) => ({ ...g, categoryName: c.name })),
      ),
    [categories],
  );

  const guestsMissingPhone = useMemo(
    () => allGuests.filter((g) => !g.phone?.trim()),
    [allGuests],
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allGuests.filter((g) => g.name.toLowerCase().includes(q));
  }, [allGuests, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guests");
      const data = await res.json();
      if (!res.ok) {
        setNeedsMigration(Boolean(data.needsMigration));
        throw new Error(data.error ?? data.detail ?? "שגיאה בטעינה");
      }
      setNeedsMigration(false);
      setCategories(data.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function categoryNameFor(guest: Guest): string {
    return categories.find((c) => c.id === guest.category_id)?.name ?? "";
  }

  function openGuestContact(guest: Guest, queue?: Guest[]) {
    const list = queue && queue.length > 0 ? queue : [guest];
    const index = Math.max(0, list.findIndex((g) => g.id === guest.id));
    const current = list[index] ?? guest;
    setLinking({
      guest: current,
      categoryName: categoryNameFor(current),
      queue: list,
      index,
    });
  }

  const connectGoogle = useCallback(async () => {
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
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/guests?sync=1")}`,
      },
    });
  }, []);

  const runGoogleSync = useCallback(async () => {
    setSyncing(true);
    setSyncSummary(null);
    setError(null);
    try {
      const res = await fetch("/api/guests/sync-phones", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        detail?: string;
        reconnect?: boolean;
        matched?: number;
        unmatched?: number;
        message?: string | null;
        ambiguous?: { guestId: string }[];
      };

      if (data.reconnect || res.status === 401) {
        setGoogleConnected(false);
        await connectGoogle();
        return;
      }
      if (!res.ok) throw new Error(data.error ?? data.detail ?? "שגיאה בסנכרון");

      setGoogleConnected(true);
      const listRes = await fetch("/api/guests");
      const listData = (await listRes.json()) as { categories?: GuestCategoryWithGuests[] };
      const nextCategories = listData.categories ?? [];
      if (listRes.ok) setCategories(nextCategories);

      const ambiguousIds = new Set((data.ambiguous ?? []).map((row) => row.guestId));
      const queue = nextCategories.flatMap((category) =>
        category.guests.filter((guest) => ambiguousIds.has(guest.id)),
      );

      const parts = [`נשמרו ${data.matched ?? 0} טלפונים`];
      if (data.unmatched) parts.push(`${data.unmatched} בלי התאמה`);
      if (queue.length) parts.push(`${queue.length} לבחירה ידנית`);
      setSyncSummary(data.message ? `${parts.join(" · ")}. ${data.message}` : parts.join(" · "));

      const first = queue[0];
      if (first) {
        setLinking({
          guest: first,
          categoryName: nextCategories.find((category) => category.id === first.category_id)?.name ?? "",
          queue,
          index: 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בסנכרון אנשי קשר");
    } finally {
      setSyncing(false);
    }
  }, [connectGoogle]);

  useEffect(() => {
    let active = true;
    fetch("/api/guests/sync-phones")
      .then((res) => res.json())
      .then((data: { connected?: boolean }) => {
        if (active) setGoogleConnected(Boolean(data.connected));
      })
      .catch(() => {
        if (active) setGoogleConnected(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get("google_error");
    const noRefresh = params.get("google") === "no_refresh";
    const shouldSync = params.get("sync") === "1" && !noRefresh && !googleError;
    if (!googleError && !noRefresh && !shouldSync) return;

    const timer = window.setTimeout(() => {
      if (googleError) setError(`התחברות Google הצליחה חלקית: ${googleError}`);
      else if (noRefresh) {
        setError("Google לא נתן הרשאה קבועה לאנשי קשר. לחצי שוב על הסנכרון ואשרי את כל ההרשאות.");
      }
      if (!shouldSync) return;

      const lock = Number(sessionStorage.getItem("bait-sync-lock") ?? "0");
      if (Date.now() - lock < 8000) return;
      sessionStorage.setItem("bait-sync-lock", String(Date.now()));
      params.delete("sync");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
      void runGoogleSync();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [runGoogleSync]);

  function advanceOrCloseLinking() {
    setLinking((prev) => {
      if (!prev) return null;
      const nextIndex = prev.index + 1;
      if (nextIndex >= prev.queue.length) return null;
      const nextGuest = prev.queue[nextIndex];
      return {
        guest: nextGuest,
        categoryName: categoryNameFor(nextGuest),
        queue: prev.queue,
        index: nextIndex,
      };
    });
  }

  function patchGuestContactInState(
    categoryId: string,
    guestId: string,
    contact: { phone: string | null; contact_name: string | null },
  ) {
    updateGuestInState(categoryId, (guests) =>
      guests.map((g) =>
        g.id === guestId
          ? { ...g, phone: contact.phone, contact_name: contact.contact_name }
          : g,
      ),
    );
  }

  async function saveGuestContact(
    guestId: string,
    categoryId: string,
    contact: { phone: string | null; contact_name: string | null },
  ) {
    patchGuestContactInState(categoryId, guestId, contact);

    const res = await fetch(`/api/guests/${guestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: contact.phone,
        contact_name: contact.contact_name,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      await loadData();
      if (data.needsMigration) setNeedsMigration(true);
      throw new Error(data.error ?? data.detail ?? "שגיאה בשמירת איש קשר");
    }
    if (data.guest) {
      patchGuestContactInState(categoryId, guestId, {
        phone: data.guest.phone ?? null,
        contact_name: data.guest.contact_name ?? null,
      });
    }
    advanceOrCloseLinking();
  }

  function toggleExpanded(categoryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function openCategoryFromSearch(categoryId: string) {
    setSearchQuery("");
    setExpandedIds(new Set([categoryId]));
    requestAnimationFrame(() => {
      document.getElementById(`category-${categoryId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateGuestInState(categoryId: string, updater: (guests: Guest[]) => Guest[]) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? { ...c, guests: updater(c.guests) } : c,
      ),
    );
  }

  async function addGuest(categoryId: string, guestName: string) {
    const trimmed = guestName.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.detail ?? "שגיאה");
      updateGuestInState(categoryId, (guests) => [...guests, data.guest]);
      setExpandedIds((prev) => new Set(prev).add(categoryId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  async function addBulk(categoryId: string, bulkText: string) {
    const names = bulkText.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (names.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, names }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setCategories(data.categories ?? []);
      setExpandedIds((prev) => new Set(prev).add(categoryId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  async function updateGuest(guestId: string, categoryId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;

    updateGuestInState(categoryId, (guests) =>
      guests.map((g) => (g.id === guestId ? { ...g, name: trimmed } : g)),
    );

    try {
      const res = await fetch(`/api/guests/${guestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? data.error ?? "שגיאה");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "שגיאה");
      await loadData();
    }
  }

  async function moveGuest(guestId: string, fromCategoryId: string, toCategoryId: string) {
    if (fromCategoryId === toCategoryId) return;

    let movedGuest: Guest | null = null;
    setCategories((prev) => {
      const found = prev
        .find((c) => c.id === fromCategoryId)
        ?.guests.find((g) => g.id === guestId);
      if (!found) return prev;
      movedGuest = { ...found, category_id: toCategoryId };

      return prev.map((c) => {
        if (c.id === fromCategoryId) {
          return { ...c, guests: c.guests.filter((g) => g.id !== guestId) };
        }
        if (c.id === toCategoryId) {
          return { ...c, guests: [...c.guests, movedGuest!] };
        }
        return c;
      });
    });

    try {
      const res = await fetch(`/api/guests/${guestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: toCategoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "שגיאה");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "שגיאה");
      await loadData();
    }
  }

  async function deleteGuest(guestId: string, categoryId: string, guestName: string) {
    if (!confirm(`למחוק את "${guestName}"?`)) return;

    updateGuestInState(categoryId, (guests) => guests.filter((g) => g.id !== guestId));

    try {
      const res = await fetch(`/api/guests/${guestId}`, { method: "DELETE" });
      if (!res.ok) await loadData();
    } catch {
      await loadData();
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch("/api/guests/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");

      const newCat: GuestCategoryWithGuests = { ...data.category, guests: [] };
      setCategories((prev) => [...prev, newCat]);
      setExpandedIds(new Set([newCat.id]));
      setNewCategoryName("");
      setShowNewCategory(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  async function renameCategory(categoryId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, name: trimmed } : c)),
    );

    try {
      const res = await fetch(`/api/guests/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) await loadData();
    } catch {
      await loadData();
    }
  }

  async function deleteCategory(categoryId: string, categoryName: string, guestCount: number) {
    const msg =
      guestCount > 0
        ? `למחוק את "${categoryName}" ו-${guestCount} מוזמנים?`
        : `למחוק את "${categoryName}"?`;
    if (!confirm(msg)) return;

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(categoryId);
      return next;
    });

    try {
      const res = await fetch(`/api/guests/categories/${categoryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("שגיאה");
      await loadData();
    } catch {
      await loadData();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-28">
      <BackToHomeButton accent="violet" />

      <header className="bg-gradient-to-l from-violet-500 to-purple-600 px-4 py-8 text-white shadow-lg">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">רשימת מוזמנים</h1>
          <p className="mt-1 text-white/85">סנכרון טלפונים מ-Google, ואז ייצוא לקובץ של החברה</p>
          <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            גרסה contacts-v5
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openGuestsWhatsAppReport(categories)}
            disabled={totalGuests === 0}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            📱 שלח לוואטסאפ
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/api/guests/export-invitations";
            }}
            disabled={totalGuests === 0}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50 disabled:opacity-40"
          >
            ↓ ייצוא לחברה
          </button>
          <button
            type="button"
            onClick={() => void (googleConnected ? runGoogleSync() : connectGoogle())}
            disabled={totalGuests === 0 || syncing}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {syncing
              ? "מסנכרן טלפונים..."
              : googleConnected
                ? `סנכרן טלפונים מ-Google${guestsMissingPhone.length > 0 ? ` (${guestsMissingPhone.length})` : ""}`
                : "חבר Google וסנכרן טלפונים"}
          </button>
        </div>

        {syncSummary && (
          <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">
            {syncSummary}
          </p>
        )}

        {!loading && !error && guestsMissingPhone.length > 0 && (
          <button
            type="button"
            onClick={() => void (googleConnected ? runGoogleSync() : connectGoogle())}
            className="mb-4 w-full rounded-2xl bg-violet-50 px-4 py-3 text-right ring-1 ring-violet-200 hover:bg-violet-100/70"
          >
            <span className="block text-sm font-bold text-violet-800">
              {guestsMissingPhone.length} מוזמנים בלי טלפון — התחילי כאן
            </span>
            <span className="mt-0.5 block text-xs text-violet-600">
              הסנכרון שומר טלפון כשיש התאמה אחת ב-Google. בלי התאמה — לחצי על השם.
            </span>
          </button>
        )}

        {!loading && !error && (
          <div className="mb-4">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                🔍
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש לפי שם — למשל: אדיר"
                className="w-full rounded-2xl border border-violet-200 bg-white py-3 pr-10 pl-10 text-sm outline-none ring-violet-100 focus:ring-2 focus:ring-violet-300"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-violet-600"
                >
                  נקה
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-100">
            טוען...
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 p-6 text-center text-red-700 ring-1 ring-red-100">
            <p className="font-semibold">{error}</p>
            {needsMigration && (
              <p className="mt-2 text-sm">
                הרץ ב-Supabase:{" "}
                <code className="rounded bg-red-100 px-1">guests-categories-migration.sql</code>
                {" / "}
                <code className="rounded bg-red-100 px-1">guests-phone-migration.sql</code>
              </p>
            )}
            <button type="button" onClick={loadData} className="mt-3 text-sm font-semibold underline">
              נסה שוב
            </button>
          </div>
        )}

        {!loading && !error && isSearching && (
          <SearchResultsPanel
            query={searchQuery.trim()}
            results={searchResults}
            categories={categories}
            onOpenCategory={openCategoryFromSearch}
            onUpdateGuest={updateGuest}
            onDeleteGuest={deleteGuest}
            onMoveGuest={moveGuest}
            onLinkContact={(guest) => openGuestContact(guest)}
          />
        )}

        {!loading && !error && !isSearching && (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {categories.length} קטגוריות · {totalGuests} מוזמנים · לחצי על שם לקישור טלפון
            </p>

            <ol className="space-y-2">
              {categories.map((category, index) => (
                <CategoryAccordionItem
                  key={category.id}
                  id={`category-${category.id}`}
                  index={index + 1}
                  category={category}
                  categories={categories}
                  expanded={expandedIds.has(category.id)}
                  saving={saving}
                  onToggle={() => toggleExpanded(category.id)}
                  onAddGuest={addGuest}
                  onAddBulk={addBulk}
                  onUpdateGuest={updateGuest}
                  onDeleteGuest={deleteGuest}
                  onMoveGuest={moveGuest}
                  onLinkContact={(guest) => openGuestContact(guest)}
                  onRenameCategory={renameCategory}
                  onDeleteCategory={deleteCategory}
                />
              ))}
            </ol>

            <div className="mt-4">
              {showNewCategory ? (
                <form
                  onSubmit={addCategory}
                  className="flex gap-2 rounded-2xl bg-white p-4 ring-1 ring-violet-100"
                >
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="שם קטגוריה חדשה..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={saving || !newCategoryName.trim()}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    שמור
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCategory(false)}
                    className="rounded-xl px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200"
                  >
                    ביטול
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="w-full rounded-2xl border-2 border-dashed border-violet-200 py-3 text-sm font-semibold text-violet-600 hover:bg-violet-50"
                >
                  + קטגוריה חדשה
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {!loading && !error && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-violet-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <span className="text-sm text-slate-500">סה&quot;כ מוזמנים</span>
            <span className="text-2xl font-bold text-violet-700">
              {isSearching ? searchResults.length : totalGuests}
            </span>
          </div>
        </div>
      )}

      {linking && (
        <GuestContactLinker
          guest={linking.guest}
          categoryName={linking.categoryName}
          queueIndex={linking.queue.length > 1 ? linking.index : undefined}
          queueTotal={linking.queue.length > 1 ? linking.queue.length : undefined}
          onSave={saveGuestContact}
          onSkip={linking.queue.length > 1 ? advanceOrCloseLinking : undefined}
          onClose={() => setLinking(null)}
        />
      )}
    </div>
  );
}

function SearchResultsPanel({
  query,
  results,
  categories,
  onOpenCategory,
  onUpdateGuest,
  onDeleteGuest,
  onMoveGuest,
  onLinkContact,
}: {
  query: string;
  results: GuestWithCategory[];
  categories: GuestCategoryWithGuests[];
  onOpenCategory: (categoryId: string) => void;
  onUpdateGuest: (id: string, categoryId: string, name: string) => Promise<void>;
  onDeleteGuest: (id: string, categoryId: string, name: string) => Promise<void>;
  onMoveGuest: (guestId: string, from: string, to: string) => Promise<void>;
  onLinkContact: (guest: Guest) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-violet-100">
      <h2 className="mb-1 text-base font-bold text-slate-900">
        תוצאות חיפוש: &quot;{query}&quot;
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        {results.length === 0
          ? "לא נמצאו שמות — נסה חיפוש אחר"
          : `${results.length} תוצאות · לחצי על שם לטלפון`}
      </p>

      {results.length > 0 && (
        <ol className="space-y-2">
          {results.map((guest, index) => (
            <li
              key={guest.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50/50 px-3 py-3 ring-1 ring-violet-100"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-800">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onLinkContact(guest)}
                className="min-w-0 flex-1 text-right"
              >
                <span className="block text-sm font-semibold text-slate-900">{guest.name}</span>
                {guest.phone ? (
                  <span className="mt-0.5 block text-xs text-violet-600" dir="ltr">
                    {guest.phone}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs text-amber-600">לחצי לקישור טלפון</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onOpenCategory(guest.category_id)}
                className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50"
              >
                {guest.categoryName}
              </button>
              <SearchGuestActions
                guest={guest}
                categories={categories}
                onUpdate={(id, n) => onUpdateGuest(id, guest.category_id, n)}
                onDelete={(id, n) => onDeleteGuest(id, guest.category_id, n)}
                onMoveCategory={onMoveGuest}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SearchGuestActions({
  guest,
  categories,
  onUpdate,
  onDelete,
  onMoveCategory,
}: {
  guest: Guest;
  categories: GuestCategoryWithGuests[];
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onMoveCategory: (guestId: string, fromCategoryId: string, toCategoryId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(guest.name);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(guest.name);
      setEditing(false);
      return;
    }
    if (trimmed !== guest.name) {
      setBusy(true);
      try {
        await onUpdate(guest.id, trimmed);
      } finally {
        setBusy(false);
      }
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex w-full basis-full items-center gap-2 pt-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-violet-300 px-2 py-1.5 text-sm outline-none"
        />
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-semibold text-white"
        >
          שמור
        </button>
      </div>
    );
  }

  return (
    <>
      <select
        value={guest.category_id}
        onChange={(e) => onMoveCategory(guest.id, guest.category_id, e.target.value)}
        disabled={busy}
        title="העבר לקטגוריה"
        className="max-w-[9rem] truncate rounded-lg border border-violet-200 bg-white px-1.5 py-1 text-xs text-violet-800 outline-none"
      >
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded px-1.5 py-1 text-xs text-violet-700 hover:bg-violet-100"
      >
        ✏️
      </button>
      <button
        type="button"
        onClick={() => onDelete(guest.id, guest.name)}
        className="rounded px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        🗑
      </button>
    </>
  );
}

function CategoryAccordionItem({
  id,
  index,
  category,
  categories,
  expanded,
  saving,
  onToggle,
  onAddGuest,
  onAddBulk,
  onUpdateGuest,
  onDeleteGuest,
  onMoveGuest,
  onLinkContact,
  onRenameCategory,
  onDeleteCategory,
}: {
  id: string;
  index: number;
  category: GuestCategoryWithGuests;
  categories: GuestCategoryWithGuests[];
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onAddGuest: (categoryId: string, name: string) => Promise<void>;
  onAddBulk: (categoryId: string, bulkText: string) => Promise<void>;
  onUpdateGuest: (id: string, categoryId: string, name: string) => Promise<void>;
  onDeleteGuest: (id: string, categoryId: string, name: string) => Promise<void>;
  onMoveGuest: (guestId: string, from: string, to: string) => Promise<void>;
  onLinkContact: (guest: Guest) => void;
  onRenameCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string, name: string, count: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(category.name);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(category.name);
  }, [category.name, editingTitle]);

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(category.name);
      setEditingTitle(false);
      return;
    }
    if (trimmed !== category.name) await onRenameCategory(category.id, trimmed);
    setEditingTitle(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await onAddGuest(category.id, name);
    setName("");
  }

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    await onAddBulk(category.id, bulkText);
    setBulkText("");
    setShowBulk(false);
  }

  return (
    <li id={id} className="scroll-mt-24 overflow-hidden rounded-2xl bg-white ring-1 ring-violet-100">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-right transition hover:bg-violet-50/60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-slate-900">{category.name}</span>
          <span className="text-xs text-slate-500">{category.guests.length} מוזמנים</span>
        </span>
        <span
          className={`shrink-0 text-violet-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="border-t border-violet-100 px-4 pb-4 pt-3">
          <div className="mb-3 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setTitleDraft(category.name);
                setEditingTitle(true);
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50"
            >
              ✏️ שם
            </button>
            <button
              type="button"
              onClick={() => onDeleteCategory(category.id, category.name, category.guests.length)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              🗑 מחק
            </button>
          </div>

          {editingTitle && (
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-violet-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                type="button"
                onClick={saveTitle}
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"
              >
                שמור
              </button>
            </div>
          )}

          <form onSubmit={handleAdd} className="mb-3 flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הוסף שם..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              + הוסף
            </button>
          </form>

          <button
            type="button"
            onClick={() => setShowBulk(!showBulk)}
            className="mb-3 text-xs font-semibold text-violet-600 underline"
          >
            {showBulk ? "סגור הוספה מרובה" : "+ כמה שמות בבת אחת"}
          </button>

          {showBulk && (
            <form onSubmit={handleBulk} className="mb-3 rounded-xl bg-violet-50/50 p-3">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={3}
                placeholder="שם בכל שורה..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                type="submit"
                disabled={saving || !bulkText.trim()}
                className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                הוסף הכל
              </button>
            </form>
          )}

          {category.guests.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">אין שמות — הוסף למעלה</p>
          ) : (
            <ol className="space-y-1">
              {category.guests.map((guest, guestIndex) => (
                <GuestRow
                  key={guest.id}
                  guest={guest}
                  index={guestIndex + 1}
                  categories={categories}
                  onUpdate={(id, n) => onUpdateGuest(id, category.id, n)}
                  onDelete={(id, n) => onDeleteGuest(id, category.id, n)}
                  onMoveCategory={onMoveGuest}
                  onLinkContact={() => onLinkContact(guest)}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

function GuestRow({
  guest,
  index,
  categories,
  onUpdate,
  onDelete,
  onMoveCategory,
  onLinkContact,
}: {
  guest: Guest;
  index: number;
  categories: GuestCategoryWithGuests[];
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onMoveCategory: (guestId: string, fromCategoryId: string, toCategoryId: string) => Promise<void>;
  onLinkContact: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(guest.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(guest.name);
  }, [guest.name, editing]);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(guest.name);
      setEditing(false);
      return;
    }
    if (trimmed !== guest.name) {
      setBusy(true);
      try {
        await onUpdate(guest.id, trimmed);
      } finally {
        setBusy(false);
      }
    }
    setEditing(false);
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 hover:bg-violet-50/50">
      <span className="w-6 shrink-0 text-center text-xs font-medium text-violet-500">{index}</span>

      {editing ? (
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            disabled={busy}
            className="min-w-0 flex-1 rounded-lg border border-violet-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-semibold text-white"
          >
            שמור
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onLinkContact}
            className="min-w-0 flex-1 rounded-lg px-1 py-1 text-right hover:bg-violet-100/80 active:bg-violet-100"
          >
            <span className="block text-sm font-semibold text-slate-800">{guest.name}</span>
            {guest.phone ? (
              <span className="mt-0.5 block text-xs text-violet-600" dir="ltr">
                {guest.contact_name && guest.contact_name !== guest.name
                  ? `${guest.contact_name} · `
                  : ""}
                {guest.phone}
              </span>
            ) : (
              <span className="mt-0.5 block text-xs font-semibold text-amber-600">
                אין טלפון — לחצי לקישור
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onLinkContact}
            className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm active:bg-violet-700"
          >
            📇 טלפון
          </button>
          <select
            value={guest.category_id}
            onChange={(e) => onMoveCategory(guest.id, guest.category_id, e.target.value)}
            disabled={busy}
            title="העבר לקטגוריה"
            className="max-w-[7rem] truncate rounded-lg border border-violet-200 bg-white px-1.5 py-1 text-xs text-violet-800 outline-none sm:max-w-[10rem]"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded px-1.5 py-1 text-xs text-violet-700 hover:bg-violet-100"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onDelete(guest.id, guest.name)}
            className="rounded px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            🗑
          </button>
        </>
      )}
    </li>
  );
}
