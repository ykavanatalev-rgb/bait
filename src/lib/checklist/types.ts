export type ChecklistCategory = "wedding" | "home" | "henna";

export type ChecklistAccent = "rose" | "emerald" | "amber";

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  sub_category: string;
  item_name: string;
  is_checked: boolean;
  price: number;
  sort_order: number;
  created_at?: string;
}

export interface ChecklistPageConfig {
  category: ChecklistCategory;
  title: string;
  subtitle: string;
  backHref: string;
  accent: ChecklistAccent;
}
