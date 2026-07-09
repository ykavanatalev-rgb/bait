export type DatabaseProvider = "supabase" | "firebase" | "postgres" | "other";
export type HostingProvider = "vercel" | "render" | "aws" | "other";

export interface InfrastructureProject {
  id: string;
  project_name: string;
  database_provider: DatabaseProvider | null;
  database_details: string | null;
  hosting_provider: HostingProvider | null;
  hosting_details: string | null;
  repo_url: string | null;
  repo_account: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
