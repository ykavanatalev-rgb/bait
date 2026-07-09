import type { ChecklistItem } from "./types";

export function getOrderedSubCategories(items: ChecklistItem[]): string[] {
  const order = new Map<string, number>();
  for (const item of items) {
    const current = order.get(item.sub_category);
    if (current === undefined || item.sort_order < current) {
      order.set(item.sub_category, item.sort_order);
    }
  }
  return [...order.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "he"))
    .map(([name]) => name);
}

export function groupItemsBySubCategory(
  items: ChecklistItem[],
): { subCategory: string; items: ChecklistItem[] }[] {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = groups.get(item.sub_category) ?? [];
    list.push(item);
    groups.set(item.sub_category, list);
  }

  const order = getOrderedSubCategories(items);
  return order.map((subCategory) => ({
    subCategory,
    items: groups.get(subCategory) ?? [],
  }));
}
