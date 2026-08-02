-- הרץ ב-Supabase → SQL Editor
-- מוסיף שדות טלפון ושם איש קשר לרשימת מוזמנים (סינכרון מאנשי הקשר במכשיר)

alter table guests add column if not exists phone text;
alter table guests add column if not exists contact_name text;
