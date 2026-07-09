import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { isAdminEmail } from "@/lib/supabase/config";
import { createInfrastructureProject, listInfrastructureProjects } from "@/lib/infrastructure/db";

async function requireAdmin() {
  const user = await getCurrentAuthUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  try {
    const projects = await listInfrastructureProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה בטעינת הפרויקטים", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, string | null | undefined>;
  const projectName = body.project_name?.trim();
  if (!projectName) {
    return NextResponse.json({ error: "project_name הוא שדה חובה" }, { status: 400 });
  }

  try {
    const project = await createInfrastructureProject({
      project_name: projectName,
      database_provider: body.database_provider || null,
      database_details: body.database_details?.trim() || null,
      hosting_provider: body.hosting_provider || null,
      hosting_details: body.hosting_details?.trim() || null,
      repo_url: body.repo_url?.trim() || null,
      repo_account: body.repo_account?.trim() || null,
      notes: body.notes?.trim() || null,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "שגיאה ביצירת פרויקט", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
