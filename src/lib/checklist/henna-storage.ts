import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistCategory } from "./types";

export const HENNA_LEGACY_PREFIX = "חינה · ";
export const HENNA_LEGACY_DB_CATEGORY = "wedding" as const;

let hennaNativeCache: boolean | null = null;

export function isHennaConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "23514" ||
    Boolean(e.message?.includes("checklist_items_category_check"))
  );
}

export async function usesHennaNativeCategory(
  supabase: SupabaseClient,
): Promise<boolean> {
  if (hennaNativeCache !== null) return hennaNativeCache;

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      category: "henna",
      sub_category: "__henna_probe__",
      item_name: "__henna_probe__",
      is_checked: false,
      price: 0,
      sort_order: 999999,
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    await supabase.from("checklist_items").delete().eq("id", data.id);
    hennaNativeCache = true;
    return true;
  }

  if (isHennaConstraintError(error)) {
    hennaNativeCache = false;
    return false;
  }

  throw error;
}

export function toDbCategoryAndSub(
  category: ChecklistCategory,
  sub_category: string,
  hennaNative: boolean,
): { dbCategory: string; dbSubCategory: string } {
  if (category !== "henna" || hennaNative) {
    return { dbCategory: category, dbSubCategory: sub_category };
  }
  return {
    dbCategory: HENNA_LEGACY_DB_CATEGORY,
    dbSubCategory: `${HENNA_LEGACY_PREFIX}${sub_category}`,
  };
}

export function mapHennaRowFromDb(
  row: Record<string, unknown>,
  hennaNative: boolean,
): { category: ChecklistCategory; sub_category: string } {
  const category = String(row.category);
  const sub_category = String(row.sub_category);

  if (category === "henna" || hennaNative) {
    return { category: category as ChecklistCategory, sub_category };
  }

  if (
    category === HENNA_LEGACY_DB_CATEGORY &&
    sub_category.startsWith(HENNA_LEGACY_PREFIX)
  ) {
    return {
      category: "henna",
      sub_category: sub_category.slice(HENNA_LEGACY_PREFIX.length),
    };
  }

  return { category: category as ChecklistCategory, sub_category };
}

export function extractDbError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as { message?: string; details?: string; hint?: string };
    if (e.message) {
      return [e.message, e.details, e.hint].filter(Boolean).join(" — ");
    }
  }
  return "unknown";
}
