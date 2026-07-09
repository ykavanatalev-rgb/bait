import { NextRequest, NextResponse } from "next/server";
import { moveGuest, updateGuestName } from "@/lib/guests/db";

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
    const body = (await request.json()) as {
      name?: string;
      category_id?: string;
    };

    if (body.category_id && body.name?.trim()) {
      await updateGuestName(id, body.name);
      const guest = await moveGuest(id, body.category_id);
      return NextResponse.json({ guest });
    }

    if (body.category_id) {
      const guest = await moveGuest(id, body.category_id);
      return NextResponse.json({ guest });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "נדרש name או category_id" }, { status: 400 });
    }

    const guest = await updateGuestName(id, name);
    return NextResponse.json({ guest });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה בעדכון מוזמן",
        detail: extractError(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createAdminClient();
    const { error } = await supabase.from("guests").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "שגיאה במחיקה",
        detail: extractError(error),
      },
      { status: 500 },
    );
  }
}
