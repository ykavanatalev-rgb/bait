import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCategoryForSubcategoryQuery } from "@/lib/checklist/db";
import { extractDbError } from "@/lib/checklist/henna-storage";
import type { ChecklistCategory } from "@/lib/checklist/types";

function parseCategory(value: unknown): ChecklistCategory | null {
  if (value === "wedding" || value === "home" || value === "henna") return value;
  return null;
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      category?: ChecklistCategory;
      old_name?: string;
      new_name?: string;
    };

    const category = parseCategory(body.category);
    const old_name = body.old_name?.trim();
    const new_name = body.new_name?.trim();

    if (!category || !old_name || !new_name) {
      return NextResponse.json(
        { error: "category, old_name ו-new_name הם שדות חובה" },
        { status: 400 },
      );
    }

    if (old_name === new_name) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const supabase = createAdminClient();
    const oldDb = await resolveCategoryForSubcategoryQuery(category, old_name);
    const newDb = await resolveCategoryForSubcategoryQuery(category, new_name);

    const { data, error } = await supabase
      .from("checklist_items")
      .update({ sub_category: newDb.dbSubCategory })
      .eq("category", oldDb.dbCategory)
      .eq("sub_category", oldDb.dbSubCategory)
      .select("id");

    if (error) throw error;

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה בשינוי שם קטגוריה",
        detail: extractDbError(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      category?: ChecklistCategory;
      sub_category?: string;
    };

    const category = parseCategory(body.category);
    const sub_category = body.sub_category?.trim();

    if (!category || !sub_category) {
      return NextResponse.json(
        { error: "category ו-sub_category הם שדות חובה" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { dbCategory, dbSubCategory } = await resolveCategoryForSubcategoryQuery(
      category,
      sub_category,
    );

    const { error, count } = await supabase
      .from("checklist_items")
      .delete({ count: "exact" })
      .eq("category", dbCategory)
      .eq("sub_category", dbSubCategory);

    if (error) throw error;

    return NextResponse.json({ ok: true, deleted: count ?? 0 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה במחיקת קטגוריה",
        detail: extractDbError(error),
      },
      { status: 500 },
    );
  }
}
