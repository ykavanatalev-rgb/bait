import { createAdminClient } from "@/lib/supabase/server";
import {
  HENNA_LEGACY_PREFIX,
  mapHennaRowFromDb,
  toDbCategoryAndSub,
  usesHennaNativeCategory,
} from "./henna-storage";
import {
  DEPRECATED_HOME_ITEMS,
  getSeedForCategory,
} from "./seed-data";
import type { ChecklistCategory, ChecklistItem } from "./types";

function mapRow(
  row: Record<string, unknown>,
  hennaNative = true,
): ChecklistItem {
  const mapped = mapHennaRowFromDb(row, hennaNative);

  return {
    id: String(row.id),
    category: mapped.category,
    sub_category: mapped.sub_category,
    item_name: String(row.item_name),
    is_checked: Boolean(row.is_checked),
    price: Number(row.price ?? 0),
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchChecklistItems(
  category: ChecklistCategory,
): Promise<ChecklistItem[]> {
  const supabase = createAdminClient();

  if (category === "henna") {
    const hennaNative = await usesHennaNativeCategory(supabase);
    if (hennaNative) {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("category", "henna")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => mapRow(row, true));
    }

    const { data, error } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("category", "wedding")
      .like("sub_category", `${HENNA_LEGACY_PREFIX}%`)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row, false));
  }

  if (category === "wedding") {
    const hennaNative = await usesHennaNativeCategory(supabase);
    let query = supabase
      .from("checklist_items")
      .select("*")
      .eq("category", "wedding");

    if (!hennaNative) {
      query = query.not("sub_category", "like", `${HENNA_LEGACY_PREFIX}%`);
    }

    const { data, error } = await query
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row, hennaNative));
  }

  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("category", category)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row, true));
}

export async function seedChecklistCategory(
  category: ChecklistCategory,
): Promise<ChecklistItem[]> {
  const supabase = createAdminClient();
  const hennaNative =
    category === "henna" ? await usesHennaNativeCategory(supabase) : true;

  const seed = getSeedForCategory(category).map((item) => {
    const { dbCategory, dbSubCategory } = toDbCategoryAndSub(
      category,
      item.sub_category,
      hennaNative,
    );
    return {
      category: dbCategory,
      sub_category: dbSubCategory,
      item_name: item.item_name,
      is_checked: false,
      price: 0,
      sort_order: item.sort_order,
    };
  });

  const { error } = await supabase.from("checklist_items").insert(seed);
  if (error) throw error;

  return fetchChecklistItems(category);
}

async function syncHomeSeedUpdates(): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("checklist_items")
    .delete()
    .eq("category", "home")
    .in("item_name", DEPRECATED_HOME_ITEMS);

  await supabase
    .from("checklist_items")
    .delete()
    .eq("category", "home")
    .eq("sub_category", "מטבח · כלי מטבח");

  const existing = await fetchChecklistItems("home");
  const existingKeys = new Set(
    existing.map((item) => `${item.sub_category}::${item.item_name}`),
  );

  const missing = getSeedForCategory("home")
    .filter((item) => !existingKeys.has(`${item.sub_category}::${item.item_name}`))
    .map((item) => ({
      category: "home" as const,
      sub_category: item.sub_category,
      item_name: item.item_name,
      is_checked: false,
      price: 0,
      sort_order: item.sort_order,
    }));

  if (missing.length > 0) {
    const { error } = await supabase.from("checklist_items").insert(missing);
    if (error) throw error;
  }
}

async function syncHennaSeedUpdates(): Promise<void> {
  const supabase = createAdminClient();
  const hennaNative = await usesHennaNativeCategory(supabase);
  const existing = await fetchChecklistItems("henna");
  const existingKeys = new Set(
    existing.map((item) => `${item.sub_category}::${item.item_name}`),
  );

  const missing = getSeedForCategory("henna")
    .filter((item) => !existingKeys.has(`${item.sub_category}::${item.item_name}`))
    .map((item) => {
      const { dbCategory, dbSubCategory } = toDbCategoryAndSub(
        "henna",
        item.sub_category,
        hennaNative,
      );
      return {
        category: dbCategory,
        sub_category: dbSubCategory,
        item_name: item.item_name,
        is_checked: false,
        price: 0,
        sort_order: item.sort_order,
      };
    });

  if (missing.length > 0) {
    const { error } = await supabase.from("checklist_items").insert(missing);
    if (error) throw error;
  }
}

export async function ensureChecklistSeeded(
  category: ChecklistCategory,
): Promise<ChecklistItem[]> {
  const items = await fetchChecklistItems(category);

  if (items.length === 0) {
    return seedChecklistCategory(category);
  }

  if (category === "home") {
    await syncHomeSeedUpdates();
    return fetchChecklistItems(category);
  }

  if (category === "henna") {
    await syncHennaSeedUpdates();
    return fetchChecklistItems(category);
  }

  return items;
}

export async function resolveCategoryForInsert(
  category: ChecklistCategory,
  sub_category: string,
): Promise<{ dbCategory: string; dbSubCategory: string }> {
  const supabase = createAdminClient();
  const hennaNative =
    category === "henna" ? await usesHennaNativeCategory(supabase) : true;
  return toDbCategoryAndSub(category, sub_category, hennaNative);
}

export async function resolveCategoryForSubcategoryQuery(
  category: ChecklistCategory,
  sub_category: string,
): Promise<{ dbCategory: string; dbSubCategory: string }> {
  return resolveCategoryForInsert(category, sub_category);
}
