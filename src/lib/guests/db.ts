import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_GUEST_CATEGORIES } from "./types";
import type { Guest, GuestCategory, GuestCategoryWithGuests } from "./types";

function mapCategory(row: Record<string, unknown>): GuestCategory {
  return {
    id: String(row.id),
    name: String(row.name),
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

function mapGuest(row: Record<string, unknown>): Guest {
  return {
    id: String(row.id),
    category_id: String(row.category_id),
    name: String(row.name),
    phone: row.phone != null && String(row.phone).trim() ? String(row.phone).trim() : null,
    contact_name:
      row.contact_name != null && String(row.contact_name).trim()
        ? String(row.contact_name).trim()
        : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchCategories(): Promise<GuestCategory[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guest_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

export async function fetchGuests(): Promise<Guest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapGuest);
}

export async function fetchCategoriesWithGuests(): Promise<GuestCategoryWithGuests[]> {
  const categories = await fetchCategories();
  const guests = await fetchGuests();

  return categories.map((category) => ({
    ...category,
    guests: guests.filter((g) => g.category_id === category.id),
  }));
}

async function seedDefaultCategories(): Promise<GuestCategory[]> {
  const supabase = createAdminClient();
  const rows = DEFAULT_GUEST_CATEGORIES.map((name, index) => ({
    name,
    sort_order: index + 1,
  }));

  const { error } = await supabase.from("guest_categories").insert(rows);
  if (error) throw error;
  return fetchCategories();
}

async function migrateOrphanGuests(categories: GuestCategory[]): Promise<void> {
  if (categories.length === 0) return;

  const supabase = createAdminClient();
  const { data: orphans } = await supabase
    .from("guests")
    .select("id")
    .is("category_id", null);

  if (!orphans?.length) return;

  await supabase
    .from("guests")
    .update({ category_id: categories[0].id })
    .is("category_id", null);
}

export async function ensureGuestCategoriesSeeded(): Promise<GuestCategoryWithGuests[]> {
  let categories = await fetchCategories();

  if (categories.length === 0) {
    categories = await seedDefaultCategories();
  }

  await migrateOrphanGuests(categories);
  return fetchCategoriesWithGuests();
}

export async function createCategory(name: string): Promise<GuestCategory> {
  const supabase = createAdminClient();
  const trimmed = name.trim();

  const { data: maxRow } = await supabase
    .from("guest_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("guest_categories")
    .insert({ name: trimmed, sort_order })
    .select("*")
    .single();

  if (error) throw error;
  return mapCategory(data);
}

export async function renameCategory(id: string, name: string): Promise<GuestCategory> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guest_categories")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCategory(data);
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("guest_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function createGuest(categoryId: string, name: string): Promise<Guest> {
  const supabase = createAdminClient();
  const trimmed = name.trim();

  const { data: existing } = await supabase
    .from("guests")
    .select("id")
    .eq("category_id", categoryId)
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) {
    throw new Error("השם כבר קיים בקטגוריה זו");
  }

  const { data: maxRow } = await supabase
    .from("guests")
    .select("sort_order")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("guests")
    .insert({ category_id: categoryId, name: trimmed, sort_order })
    .select("*")
    .single();

  if (error) throw error;
  return mapGuest(data);
}

export async function createGuestsBulk(
  categoryId: string,
  names: string[],
): Promise<Guest[]> {
  const existing = await fetchGuests();
  const existingInCategory = new Set(
    existing
      .filter((g) => g.category_id === categoryId)
      .map((g) => g.name.trim().toLowerCase()),
  );

  const unique = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && !existingInCategory.has(n.toLowerCase()));

  if (unique.length === 0) return [];

  const supabase = createAdminClient();
  const inCategory = existing.filter((g) => g.category_id === categoryId);
  let sort_order =
    inCategory.length > 0 ? Math.max(...inCategory.map((g) => g.sort_order)) : 0;

  const rows = unique.map((name) => {
    sort_order += 1;
    return { category_id: categoryId, name, sort_order };
  });

  const { data, error } = await supabase.from("guests").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []).map(mapGuest);
}

export async function moveGuest(guestId: string, targetCategoryId: string): Promise<Guest> {
  const supabase = createAdminClient();

  const { data: guest, error: fetchError } = await supabase
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .single();

  if (fetchError || !guest) throw fetchError ?? new Error("מוזמן לא נמצא");

  if (guest.category_id === targetCategoryId) {
    return mapGuest(guest);
  }

  const { data: duplicate } = await supabase
    .from("guests")
    .select("id")
    .eq("category_id", targetCategoryId)
    .ilike("name", guest.name)
    .neq("id", guestId)
    .maybeSingle();

  if (duplicate) {
    throw new Error("השם כבר קיים בקטגוריה היעד");
  }

  const { data: maxRow } = await supabase
    .from("guests")
    .select("sort_order")
    .eq("category_id", targetCategoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("guests")
    .update({ category_id: targetCategoryId, sort_order })
    .eq("id", guestId)
    .select("*")
    .single();

  if (error) throw error;
  return mapGuest(data);
}

export async function updateGuestName(guestId: string, name: string): Promise<Guest> {
  const supabase = createAdminClient();
  const trimmed = name.trim();

  const { data: guest } = await supabase
    .from("guests")
    .select("category_id")
    .eq("id", guestId)
    .single();

  if (!guest) throw new Error("מוזמן לא נמצא");

  const { data: duplicate } = await supabase
    .from("guests")
    .select("id")
    .eq("category_id", guest.category_id)
    .ilike("name", trimmed)
    .neq("id", guestId)
    .maybeSingle();

  if (duplicate) throw new Error("השם כבר קיים בקטגוריה זו");

  const { data, error } = await supabase
    .from("guests")
    .update({ name: trimmed })
    .eq("id", guestId)
    .select("*")
    .single();

  if (error) throw error;
  return mapGuest(data);
}

export async function updateGuestContactsBulk(
  updates: { id: string; phone: string; contact_name: string | null }[],
): Promise<number> {
  if (updates.length === 0) return 0;
  const supabase = createAdminClient();
  const chunkSize = 20;

  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    const results = await Promise.all(
      chunk.map((row) =>
        supabase
          .from("guests")
          .update({ phone: row.phone, contact_name: row.contact_name })
          .eq("id", row.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  }

  return updates.length;
}

export async function updateGuestContact(
  guestId: string,
  fields: { phone?: string | null; contact_name?: string | null },
): Promise<Guest> {
  const supabase = createAdminClient();

  const patch: Record<string, string | null> = {};
  if ("phone" in fields) {
    const phone = fields.phone?.trim() || null;
    patch.phone = phone;
  }
  if ("contact_name" in fields) {
    const contact_name = fields.contact_name?.trim() || null;
    patch.contact_name = contact_name;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("אין שדות לעדכון");
  }

  const { data, error } = await supabase
    .from("guests")
    .update(patch)
    .eq("id", guestId)
    .select("*")
    .single();

  if (error) throw error;
  return mapGuest(data);
}
