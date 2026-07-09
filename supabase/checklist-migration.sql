-- הרץ ב-Supabase → SQL Editor (פרויקט bait)
-- אם כבר הרצת schema.sql המעודכן, אפשר לדלג

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
