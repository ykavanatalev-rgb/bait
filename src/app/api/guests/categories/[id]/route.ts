import { NextRequest, NextResponse } from "next/server";
import { deleteCategory, renameCategory } from "@/lib/guests/db";

type RouteContext = { params: Promise<{ id: string }> };

function extractError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "unknown";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name הוא שדה חובה" }, { status: 400 });
    }

    const category = await renameCategory(id, name);
    return NextResponse.json({ category });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה בעדכון קטגוריה", detail: extractError(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await deleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה במחיקת קטגוריה", detail: extractError(error) },
      { status: 500 },
    );
  }
}
