import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("checklist_items").select("id").limit(1);

    if (error) {
      return NextResponse.json({
        ok: false,
        message: "טבלת checklist_items לא קיימת — הרץ את supabase/checklist-migration.sql ב-SQL Editor",
        detail: error.message,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "טבלת checklist_items מוכנה",
    });
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
