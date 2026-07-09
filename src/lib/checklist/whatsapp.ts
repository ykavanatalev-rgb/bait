import { calcBudgetSummary } from "./csv";
import { groupItemsBySubCategory } from "./grouping";
import type { ChecklistItem } from "./types";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatItemLine(item: ChecklistItem): string {
  const price = item.price > 0 ? ` — ${formatMoney(item.price)}` : "";
  return `• ${item.item_name}${price}`;
}

export function buildWhatsAppReport(items: ChecklistItem[], pageTitle: string): string {
  const groups = groupItemsBySubCategory(items);
  const summary = calcBudgetSummary(items);
  const date = new Date().toLocaleDateString("he-IL");
  const lines: string[] = [`📋 *דוח Bait — ${pageTitle}*`, `📅 ${date}`, ""];

  const checked = items.filter((i) => i.is_checked);
  const unchecked = items.filter((i) => !i.is_checked);

  lines.push(`✅ *יש / בוצע (${checked.length}):*`);
  if (checked.length === 0) {
    lines.push("— אין פריטים שסומנו עדיין —");
  } else {
    for (const group of groups) {
      const groupChecked = group.items.filter((i) => i.is_checked);
      if (groupChecked.length === 0) continue;
      lines.push("");
      lines.push(`*${group.subCategory}*`);
      groupChecked.forEach((item) => lines.push(formatItemLine(item)));
    }
  }

  lines.push("");
  lines.push(`❌ *חסר / לא בוצע (${unchecked.length}):*`);
  if (unchecked.length === 0) {
    lines.push("— הכל בוצע! 🎉 —");
  } else {
    for (const group of groups) {
      const groupUnchecked = group.items.filter((i) => !i.is_checked);
      if (groupUnchecked.length === 0) continue;
      lines.push("");
      lines.push(`*${group.subCategory}*`);
      groupUnchecked.forEach((item) => lines.push(formatItemLine(item)));
    }
  }

  lines.push("");
  lines.push("💰 *סיכום:*");
  lines.push(`סה"כ משוער: ${formatMoney(summary.totalEstimated)}`);
  lines.push(`בוצע (V): ${formatMoney(summary.totalChecked)}`);
  lines.push(`נותר: ${formatMoney(summary.totalEstimated - summary.totalChecked)}`);
  lines.push(`פריטים: ${summary.checkedCount}/${summary.totalCount}`);

  return lines.join("\n");
}

export function openWhatsAppReport(items: ChecklistItem[], pageTitle: string): void {
  let text = buildWhatsAppReport(items, pageTitle);
  const maxLen = 3500;
  if (text.length > maxLen) {
    text = `${text.slice(0, maxLen)}\n\n…(הדוח קוצר — הורד CSV לדוח מלא)`;
  }
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
