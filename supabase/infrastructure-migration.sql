-- הרץ ב-Supabase → SQL Editor (פרויקט bait / wzjrtnjbacglpvqhfdgk)
-- טבלת תיעוד תשתיות (DevOps Tracker) — עמוד /infrastructure, Admin בלבד.
--
-- שימו לב: הטבלה הזו מיועדת לשמור פרטי חשבון/הפניות לתשתיות של
-- הפרויקטים שלכם. מומלץ לא לשמור כאן סודות מלאים (מפתחות API,
-- סיסמאות) בטקסט גלוי — מוטב לשמור הפניה ("איפה למצוא את המפתח")
-- ולא את הערך הרגיש עצמו. הטבלה מוגנת ב-RLS (בלי policies) כך שרק
-- ה-API של השרת עם service_role יכול לגשת אליה, וה-API בעצמו בודק
-- שהמשתמש המחובר הוא Admin (לפי ADMIN_EMAILS בסביבת השרת).

create extension if not exists "pgcrypto";

create table if not exists infrastructure_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  database_provider text check (database_provider in ('supabase', 'firebase', 'postgres', 'other')),
  database_details text,
  hosting_provider text check (hosting_provider in ('vercel', 'render', 'aws', 'other')),
  hosting_details text,
  repo_url text,
  repo_account text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists infrastructure_projects_project_name_idx
  on infrastructure_projects (project_name);

alter table infrastructure_projects enable row level security;
revoke all on infrastructure_projects from anon, authenticated;

-- שורת פתיחה לפרויקט הזה עצמו — אפשר לערוך/למחוק מתוך העמוד
insert into infrastructure_projects (project_name, database_provider, hosting_provider, repo_url, repo_account)
select 'bait', 'supabase', 'vercel', 'https://github.com/ykavanatalev-rgb/bait', 'ykavanatalev-rgb'
where not exists (select 1 from infrastructure_projects where project_name = 'bait');
