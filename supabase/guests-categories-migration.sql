-- הרץ ב-Supabase → SQL Editor (למי שכבר יצר את טבלת guests)

create table if not exists guest_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table guests add column if not exists category_id uuid references guest_categories(id) on delete cascade;

create index if not exists guest_categories_sort_order_idx on guest_categories (sort_order);
create index if not exists guests_category_id_idx on guests (category_id);

-- קטגוריות ראשוניות (רק אם הטבלה ריקה)
insert into guest_categories (name, sort_order)
select name, sort_order from (values
  ('משפחת קובליו', 1),
  ('משפחת קדוש', 2),
  ('משפחת קרמר', 3),
  ('משפחת גלבך', 4),
  ('חברים שירה', 5),
  ('חברים יצחק', 6)
) as seed(name, sort_order)
where not exists (select 1 from guest_categories limit 1);

-- מוזמנים קיימים ללא קטגוריה → עוברים לקטegoria הראשונה
update guests
set category_id = (select id from guest_categories order by sort_order limit 1)
where category_id is null
  and exists (select 1 from guest_categories limit 1);
