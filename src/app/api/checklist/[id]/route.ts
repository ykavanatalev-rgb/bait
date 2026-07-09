import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      is_checked?: boolean;
      price?: number;
      item_name?: string;
    };

    const updates: Record<string, unknown> = {};
    if (typeof body.is_checked === "boolean") updates.is_checked = body.is_checked;
    if (typeof body.price === "number" && !Number.isNaN(body.price)) {
      updates.price = body.price;
    }
    if (typeof body.item_name === "string" && body.item_name.trim()) {
      updates.item_name = body.item_name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("checklist_items")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה בעדכון פריט",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה במחיקת פריט",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
