-- הרץ ב-Supabase → SQL Editor (פרויקט bait / wzjrtnjbacglpvqhfdgk)
-- מוסיף את הטבלאות עבור עמוד /tasks (משימות + התחברות עם Google)

create extension if not exists "pgcrypto";

-- פרופיל משתמש שהתחבר עם Google. ה-id תואם למשתמש ב-auth.users (Supabase Auth).
-- google_refresh_token נשמר כדי שהשרת יוכל למלא access token חדש בכל פעם
-- שצריך לגשת ל-Calendar/People API בשם המשתמש הזה, גם כשמישהו אחר יוצר לו משימה.
create table if not exists task_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  google_refresh_token text,
  google_scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_profiles_email_idx on task_profiles (email);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references task_profiles(id) on delete cascade,
  assigned_to uuid references task_profiles(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done')),
  completion_summary text,
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_created_by_idx on tasks (created_by);
create index if not exists tasks_assigned_to_idx on tasks (assigned_to);
create index if not exists tasks_status_idx on tasks (status);

-- התראה שמופיעה למי שיצר משימה, כשהאחראי מסמן אותה כבוצעה עם סיכום
create table if not exists task_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references task_profiles(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists task_notifications_user_id_idx on task_notifications (user_id, is_read);

-- אבטחה: כל הגישה עוברת רק דרך ה-API (Next.js) עם service_role key,
-- שעוקף RLS אוטומטית. מפעילים RLS בלי policies כדי לחסום גישה ציבורית/anon
-- ישירה דרך ה-REST API האוטומטי של Supabase — בדיוק כמו שאר הטבלאות באפליקציה.
alter table task_profiles enable row level security;
alter table tasks enable row level security;
alter table task_notifications enable row level security;

revoke all on task_profiles from anon, authenticated;
revoke all on tasks from anon, authenticated;
revoke all on task_notifications from anon, authenticated;
