import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error: catError } = await supabase.from("guest_categories").select("id").limit(1);
    const { error: guestError } = await supabase.from("guests").select("id").limit(1);

    if (catError) {
      return NextResponse.json({
        ok: false,
        message: "טבלת guest_categories לא קיימת — הרץ guests-categories-migration.sql",
        detail: catError.message,
      });
    }

    if (guestError) {
      return NextResponse.json({
        ok: false,
        message: "טבלת guests לא קיימת",
        detail: guestError.message,
      });
    }

    return NextResponse.json({ ok: true, message: "מערכת מוזמנים מוכנה" });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "שגיאה בבדיקה",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
