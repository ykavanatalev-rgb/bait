import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ensureChecklistSeeded,
  resolveCategoryForInsert,
} from "@/lib/checklist/db";
import { extractDbError } from "@/lib/checklist/henna-storage";
import type { ChecklistCategory } from "@/lib/checklist/types";

function parseCategory(value: string | null): ChecklistCategory | null {
  if (value === "wedding" || value === "home" || value === "henna") return value;
  return null;
}

export async function GET(request: NextRequest) {
  const category = parseCategory(request.nextUrl.searchParams.get("category"));

  if (!category) {
    return NextResponse.json(
      { error: "category חייב להיות wedding, home או henna" },
      { status: 400 },
    );
  }

  try {
    const items = await ensureChecklistSeeded(category);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה בטעינת הרשימה",
        detail: extractDbError(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      category?: ChecklistCategory;
      sub_category?: string;
      item_name?: string;
      price?: number;
    };

    const category = body.category;
    const sub_category = body.sub_category?.trim();
    const item_name = body.item_name?.trim();

    if (!category || !sub_category || !item_name) {
      return NextResponse.json(
        { error: "category, sub_category ו-item_name הם שדות חובה" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { dbCategory, dbSubCategory } = await resolveCategoryForInsert(
      category,
      sub_category,
    );

    const { data: maxRow } = await supabase
      .from("checklist_items")
      .select("sort_order")
      .eq("category", dbCategory)
      .eq("sub_category", dbSubCategory)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sort_order = (maxRow?.sort_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("checklist_items")
      .insert({
        category: dbCategory,
        sub_category: dbSubCategory,
        item_name,
        is_checked: false,
        price: body.price ?? 0,
        sort_order,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה בהוספת פריט",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
