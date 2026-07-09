import { NextRequest, NextResponse } from "next/server";
import { createCategory, ensureGuestCategoriesSeeded } from "@/lib/guests/db";

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
    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה בטעינת קטגוריות", detail: extractError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name הוא שדה חובה" }, { status: 400 });
    }

    const category = await createCategory(name);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה ביצירת קטגוריה", detail: extractError(error) },
      { status: 500 },
    );
  }
}
