import { NextResponse } from "next/server";
import { fetchCategoriesWithGuests } from "@/lib/guests/db";
import { buildInvitationSheet } from "@/lib/guests/invitation";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await fetchCategoriesWithGuests();
    const guests = categories.flatMap((category) =>
      category.guests.map((guest) => ({
        name: guest.name,
        phone: guest.phone,
        categoryName: category.name,
      })),
    );

    const rows = buildInvitationSheet(guests);
    const sheet = XLSX.utils.aoa_to_sheet(rows);

    for (let row = 2; row < rows.length; row += 1) {
      for (const column of [4, 5]) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const cell = sheet[address];
        if (!cell || cell.v == null || cell.v === "") continue;
        cell.t = "s";
        cell.v = String(cell.v);
      }
    }

    sheet["!cols"] = [
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "הזמנות");
    const body = XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer;

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": 'attachment; filename="wedding_invitations_he-IL.xls"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: "שגיאה בייצוא הקובץ", detail }, { status: 500 });
  }
}
