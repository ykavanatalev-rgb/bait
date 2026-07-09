-- הרץ את הקובץ הזה ב-Supabase (פרויקט bait):
-- SQL Editor → New query → הדבק הכל → Run

create extension if not exists "pgcrypto";

-- הגדרות אפליקציה (שורה יחידה)
create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  app_name text not null default 'Bait',
  welcome_message text not null default 'ברוכים הבאים ל-Bait',
  updated_at timestamptz not null default now()
);

insert into app_settings (id, app_name, welcome_message)
values (1, 'Bait', 'ברוכים הבאים ל-Bait')
on conflict (id) do nothing;

-- טבלת דוגמה — אפשר למחוק או להרחיב לפי הצורך
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists notes_created_at_idx on notes (created_at desc);

-- רשימות משימות ותקציב (חתונה / בית / חינה)
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('wedding', 'home', 'henna')),
  sub_category text not null,
  item_name text not null,
  is_checked boolean not null default false,
  price numeric(12, 2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists checklist_items_category_idx
  on checklist_items (category, sort_order);

create index if not exists checklist_items_sub_category_idx
  on checklist_items (category, sub_category);

-- רשימת מוזמנים
create table if not exists guest_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists guest_categories_sort_order_idx on guest_categories (sort_order);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references guest_categories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists guests_category_id_idx on guests (category_id);
create index if not exists guests_sort_order_idx on guests (sort_order);
