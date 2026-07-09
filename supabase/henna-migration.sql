-- הרץ ב-Supabase → SQL Editor (פרויקט bait)
-- מאפשר קטגוריית "חינה" בטבלת checklist_items

alter table checklist_items drop constraint if exists checklist_items_category_check;

alter table checklist_items
  add constraint checklist_items_category_check
  check (category in ('wedding', 'home', 'henna'));
