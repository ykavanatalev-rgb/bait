import { groupItemsBySubCategory } from "./grouping";
import type { ChecklistItem } from "./types";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatMoney(amount: number): string {
  return String(Math.round(amount));
}

export function calcBudgetSummary(items: ChecklistItem[]) {
  const totalEstimated = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalChecked = items
    .filter((item) => item.is_checked)
    .reduce((sum, item) => sum + (item.price || 0), 0);
  const checkedCount = items.filter((item) => item.is_checked).length;

  return { totalEstimated, totalChecked, checkedCount, totalCount: items.length };
}

export function exportChecklistToCsv(
  items: ChecklistItem[],
  categoryLabel: string,
  pageTitle: string,
): void {
  const groups = groupItemsBySubCategory(items);
  const summary = calcBudgetSummary(items);
  const rows: string[][] = [];

  rows.push([pageTitle]);
  rows.push([`תאריך: ${new Date().toLocaleDateString("he-IL")}`]);
  rows.push([]);

  for (const group of groups) {
    const subtotal = group.items.reduce((s, i) => s + (i.price || 0), 0);
    const subChecked = group.items
      .filter((i) => i.is_checked)
      .reduce((s, i) => s + (i.price || 0), 0);

    rows.push([`קטגוריה: ${group.subCategory}`]);
    rows.push(["פריט", "בוצע", "מחיר (₪)"]);

    for (const item of group.items) {
      rows.push([
        item.item_name,
        item.is_checked ? "כן" : "לא",
        formatMoney(item.price ?? 0),
      ]);
    }

    rows.push(["סיכום קטגוריה", "", formatMoney(subtotal)]);
    rows.push(["סומן בוצע בקטגוריה", "", formatMoney(subChecked)]);
    rows.push([]);
  }

  rows.push(["סיכום כללי"]);
  rows.push(["סה\"כ עלות משוערת", "", formatMoney(summary.totalEstimated)]);
  rows.push(["סה\"כ בוצע (V)", "", formatMoney(summary.totalChecked)]);
  rows.push(["נותר", "", formatMoney(summary.totalEstimated - summary.totalChecked)]);
  rows.push([
    "פריטים שסומנו",
    `${summary.checkedCount} / ${summary.totalCount}`,
    "",
  ]);

  const csv = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bait-${categoryLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
