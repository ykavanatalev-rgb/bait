import { createAdminClient } from "@/lib/supabase/server";
import type { InfrastructureProject } from "./types";

function mapRow(row: Record<string, unknown>): InfrastructureProject {
  return {
    id: String(row.id),
    project_name: String(row.project_name),
    database_provider: (row.database_provider as InfrastructureProject["database_provider"]) ?? null,
    database_details: row.database_details ? String(row.database_details) : null,
    hosting_provider: (row.hosting_provider as InfrastructureProject["hosting_provider"]) ?? null,
    hosting_details: row.hosting_details ? String(row.hosting_details) : null,
    repo_url: row.repo_url ? String(row.repo_url) : null,
    repo_account: row.repo_account ? String(row.repo_account) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listInfrastructureProjects(): Promise<InfrastructureProject[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("infrastructure_projects")
    .select("*")
    .order("project_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createInfrastructureProject(params: {
  project_name: string;
  database_provider?: string | null;
  database_details?: string | null;
  hosting_provider?: string | null;
  hosting_details?: string | null;
  repo_url?: string | null;
  repo_account?: string | null;
  notes?: string | null;
}): Promise<InfrastructureProject> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("infrastructure_projects")
    .insert(params)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateInfrastructureProject(
  id: string,
  patch: Partial<{
    project_name: string;
    database_provider: string | null;
    database_details: string | null;
    hosting_provider: string | null;
    hosting_details: string | null;
    repo_url: string | null;
    repo_account: string | null;
    notes: string | null;
  }>,
): Promise<InfrastructureProject> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("infrastructure_projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteInfrastructureProject(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("infrastructure_projects").delete().eq("id", id);
  if (error) throw error;
}
