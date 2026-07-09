import { createAdminClient } from "@/lib/supabase/server";
import { refreshGoogleAccessToken } from "./google";
import type { Task, TaskNotification, TaskProfile } from "./types";

function mapProfile(row: Record<string, unknown>): TaskProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    full_name: row.full_name ? String(row.full_name) : null,
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    has_google_calendar: Boolean(row.google_refresh_token),
  };
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    created_by: String(row.created_by),
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    due_at: row.due_at ? String(row.due_at) : null,
    status: row.status === "done" ? "done" : "open",
    completion_summary: row.completion_summary ? String(row.completion_summary) : null,
    google_event_id: row.google_event_id ? String(row.google_event_id) : null,
    creator_google_event_id: row.creator_google_event_id
      ? String(row.creator_google_event_id)
      : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    created_by_profile: row.created_by_profile
      ? mapProfile(row.created_by_profile as Record<string, unknown>)
      : undefined,
    assigned_to_profile: row.assigned_to_profile
      ? mapProfile(row.assigned_to_profile as Record<string, unknown>)
      : undefined,
  };
}

export async function upsertTaskProfile(params: {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  refreshToken?: string | null;
  scopes?: string | null;
}) {
  const supabase = createAdminClient();

  const update: Record<string, unknown> = {
    id: params.id,
    email: params.email,
    full_name: params.fullName ?? null,
    avatar_url: params.avatarUrl ?? null,
    updated_at: new Date().toISOString(),
  };

  // רק אם קיבלנו refresh token חדש (Google שולח אותו רק בהתחברות ראשונה /
  // כשמבקשים prompt=consent) — לא דורסים טוקן קיים בערך ריק.
  if (params.refreshToken) {
    update.google_refresh_token = params.refreshToken;
    update.google_scopes = params.scopes ?? null;
  }

  const { error } = await supabase.from("task_profiles").upsert(update);
  if (error) throw error;
}

export async function getTaskProfile(userId: string): Promise<TaskProfile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("task_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function listTaskProfiles(): Promise<TaskProfile[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("task_profiles")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProfile);
}

/**
 * מחזיר access token טרי למשתמש נתון, ע"י רענון ה-refresh token השמור
 * שלו. מחזיר null אם המשתמש עדיין לא חיבר את Google (או לא אישר הרשאות
 * offline), ואז אי אפשר לגשת ליומן/אנשי הקשר שלו.
 */
export async function getGoogleAccessTokenForUser(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("task_profiles")
    .select("google_refresh_token")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.google_refresh_token) return null;

  const { accessToken } = await refreshGoogleAccessToken(data.google_refresh_token as string);
  return accessToken;
}

export async function listTasksForUser(userId: string): Promise<Task[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, created_by_profile:task_profiles!tasks_created_by_fkey(*), assigned_to_profile:task_profiles!tasks_assigned_to_fkey(*)",
    )
    .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, created_by_profile:task_profiles!tasks_created_by_fkey(*), assigned_to_profile:task_profiles!tasks_assigned_to_fkey(*)",
    )
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTask(data) : null;
}

export async function createTaskRow(params: {
  title: string;
  description?: string | null;
  createdBy: string;
  assignedTo?: string | null;
  dueAt?: string | null;
}): Promise<Task> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: params.title,
      description: params.description ?? null,
      created_by: params.createdBy,
      assigned_to: params.assignedTo ?? null,
      due_at: params.dueAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapTask(data);
}

export async function updateTaskRow(
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    assigned_to: string | null;
    due_at: string | null;
    status: "open" | "done";
    completion_summary: string | null;
    google_event_id: string | null;
    creator_google_event_id: string | null;
  }>,
): Promise<Task> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("*")
    .single();
  if (error) throw error;
  return mapTask(data);
}

export async function deleteTaskRow(taskId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function createNotification(params: {
  userId: string;
  taskId: string;
  message: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("task_notifications").insert({
    user_id: params.userId,
    task_id: params.taskId,
    message: params.message,
  });
  if (error) throw error;
}

export async function listNotificationsForUser(userId: string): Promise<TaskNotification[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("task_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    task_id: String(row.task_id),
    message: String(row.message),
    is_read: Boolean(row.is_read),
    created_at: String(row.created_at),
  }));
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("task_notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw error;
}
