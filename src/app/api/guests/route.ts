import { NextRequest, NextResponse } from "next/server";
import {
  createGuest,
  createGuestsBulk,
  ensureGuestCategoriesSeeded,
} from "@/lib/guests/db";

function extractError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "unknown";
}

export async function GET() {
  try {
    const categories = await ensureGuestCategoriesSeeded();
    const total = categories.reduce((sum, c) => sum + c.guests.length, 0);
    return NextResponse.json({ categories, total });
  } catch (error) {
    const detail = extractError(error);
    const needsMigration =
      detail.includes("guest_categories") ||
      detail.includes("category_id") ||
      detail.includes("guests");

    return NextResponse.json(
      {
        error: needsMigration
          ? "נדרש עדכון DB — הרץ SQL ב-Supabase"
          : "שגיאה בטעינת רשימת המוזמנים",
        detail,
        needsMigration,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      category_id?: string;
      name?: string;
      names?: string[];
    };

    const category_id = body.category_id;
    if (!category_id) {
      return NextResponse.json({ error: "category_id הוא שדה חובה" }, { status: 400 });
    }

    if (Array.isArray(body.names) && body.names.length > 0) {
      const added = await createGuestsBulk(category_id, body.names);
      const categories = await ensureGuestCategoriesSeeded();
      return NextResponse.json({ categories, added: added.length }, { status: 201 });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name הוא שדה חובה" }, { status: 400 });
    }

    const guest = await createGuest(category_id, name);
    return NextResponse.json({ guest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה בהוספת מוזמן",
        detail: extractError(error),
      },
      { status: 500 },
    );
  }
}
