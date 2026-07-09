export interface TaskProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  has_google_calendar: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  assigned_to: string | null;
  due_at: string | null;
  status: "open" | "done";
  completion_summary: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_profile?: TaskProfile;
  assigned_to_profile?: TaskProfile;
}

export interface TaskNotification {
  id: string;
  task_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface GoogleContactSummary {
  resourceName: string;
  name: string;
  email?: string;
  phone?: string;
}
