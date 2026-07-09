-- הרץ ב-Supabase → SQL Editor (פרויקט bait)

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists guests_sort_order_idx on guests (sort_order);
