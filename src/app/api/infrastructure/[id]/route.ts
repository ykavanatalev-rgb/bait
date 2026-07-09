import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { isAdminEmail } from "@/lib/supabase/config";
import { deleteInfrastructureProject, updateInfrastructureProject } from "@/lib/infrastructure/db";

async function requireAdmin() {
  const user = await getCurrentAuthUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as Record<string, string | null | undefined>;

  const patch: Record<string, unknown> = {};
  for (const key of [
    "project_name",
    "database_provider",
    "database_details",
    "hosting_provider",
    "hosting_details",
    "repo_url",
    "repo_account",
    "notes",
  ] as const) {
    if (body[key] !== undefined) {
      const value = body[key];
      patch[key] = typeof value === "string" ? value.trim() || null : null;
    }
  }

  try {
    const project = await updateInfrastructureProject(id, patch);
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה בעדכון פרויקט", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { id } = await params;
  await deleteInfrastructureProject(id);
  return NextResponse.json({ ok: true });
}
