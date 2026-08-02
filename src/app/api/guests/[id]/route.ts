import { NextRequest, NextResponse } from "next/server";
import { moveGuest, updateGuestContact, updateGuestName } from "@/lib/guests/db";

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
      phone?: string | null;
      contact_name?: string | null;
    };

    const hasContactPatch = "phone" in body || "contact_name" in body;

    if (body.category_id && body.name?.trim()) {
      await updateGuestName(id, body.name);
      let guest = await moveGuest(id, body.category_id);
      if (hasContactPatch) {
        guest = await updateGuestContact(id, {
          phone: body.phone,
          contact_name: body.contact_name,
        });
      }
      return NextResponse.json({ guest });
    }

    if (body.category_id) {
      let guest = await moveGuest(id, body.category_id);
      if (hasContactPatch) {
        guest = await updateGuestContact(id, {
          phone: body.phone,
          contact_name: body.contact_name,
        });
      }
      return NextResponse.json({ guest });
    }

    if (hasContactPatch && !body.name?.trim()) {
      const guest = await updateGuestContact(id, {
        phone: body.phone,
        contact_name: body.contact_name,
      });
      return NextResponse.json({ guest });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "נדרש name, category_id או phone/contact_name" },
        { status: 400 },
      );
    }

    let guest = await updateGuestName(id, name);
    if (hasContactPatch) {
      guest = await updateGuestContact(id, {
        phone: body.phone,
        contact_name: body.contact_name,
      });
    }
    return NextResponse.json({ guest });
  } catch (error) {
    const detail = extractError(error);
    const needsMigration =
      detail.includes("phone") ||
      detail.includes("contact_name") ||
      detail.includes("column");

    return NextResponse.json(
      {
        error: needsMigration
          ? "נדרש עדכון DB — הרץ guests-phone-migration.sql ב-Supabase"
          : "שגיאה בעדכון מוזמן",
        detail,
        needsMigration,
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
