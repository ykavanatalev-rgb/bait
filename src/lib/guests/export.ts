import type { GuestCategoryWithGuests } from "./types";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportGuestsToCsv(categories: GuestCategoryWithGuests[]): void {
  const total = categories.reduce((sum, c) => sum + c.guests.length, 0);
  const rows: string[][] = [
    ["רשימת מוזמנים — Bait"],
    [`תאריך: ${new Date().toLocaleDateString("he-IL")}`],
    [],
  ];

  for (const category of categories) {
    rows.push([`קטגוריה: ${category.name}`]);
    rows.push(["מס'", "שם"]);

    category.guests.forEach((guest, index) => {
      rows.push([String(index + 1), guest.name]);
    });

    rows.push(["סיכום קטגוריה", String(category.guests.length)]);
    rows.push([]);
  }

  rows.push(["סיכום כללי"]);
  rows.push(["סה\"כ מוזמנים", String(total)]);

  const csv = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bait-guests-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildGuestsWhatsAppReport(categories: GuestCategoryWithGuests[]): string {
  const total = categories.reduce((sum, c) => sum + c.guests.length, 0);
  const date = new Date().toLocaleDateString("he-IL");
  const lines: string[] = [
    "📋 *רשימת מוזמנים — Bait*",
    `📅 ${date}`,
    "",
    `👥 *סה\"כ: ${total} מוזמנים*`,
    "",
  ];

  if (total === 0) {
    lines.push("— הרשימה ריקה —");
    return lines.join("\n");
  }

  for (const category of categories) {
    lines.push(`*${category.name}* (${category.guests.length})`);
    if (category.guests.length === 0) {
      lines.push("— אין מוזמנים —");
    } else {
      category.guests.forEach((guest, i) => {
        lines.push(`${i + 1}. ${guest.name}`);
      });
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function openGuestsWhatsAppReport(categories: GuestCategoryWithGuests[]): void {
  let text = buildGuestsWhatsAppReport(categories);
  const maxLen = 3500;
  if (text.length > maxLen) {
    text = `${text.slice(0, maxLen)}\n\n…(הדוח קוצר — הורד Excel לרשימה מלאה)`;
  }
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
