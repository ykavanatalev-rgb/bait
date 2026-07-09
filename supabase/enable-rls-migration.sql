-- הרץ ב-Supabase → SQL Editor (פרויקט bait / wzjrtnjbacglpvqfdgk)
-- מטפל בהתראת האבטחה "Table publicly accessible" (rls_disabled_in_public)
--
-- האפליקציה שלנו פונה למסד הנתונים רק מהשרת (Next.js API routes) עם
-- ה-service_role key (ראו src/lib/supabase/server.ts). מפתח זה עוקף RLS
-- באופן אוטומטי ב-Supabase/Postgres (bypassrls), כך שהפעלת RLS כאן לא
-- תפגע באפליקציה בשום צורה — היא רק תחסום גישה ציבורית/anon ישירה
-- דרך ה-REST API האוטומטי של Supabase.
--
-- לא צריך policies בכלל: אין RLS policies => אין גישה ל-anon/authenticated,
-- ו-service_role ממשיך לעבוד כרגיל בלי תלות ב-policies.

alter table app_settings enable row level security;
alter table notes enable row level security;
alter table checklist_items enable row level security;
alter table guest_categories enable row level security;
alter table guests enable row level security;

-- ולביטחון: מוציא במפורש כל הרשאה קיימת מ-anon/authenticated
-- (אם מישהו הגדיר GRANT בעבר). אין צורך בזה בהתקנות סטנדרטיות של
-- Supabase, אבל זה לא מזיק להריץ.
revoke all on app_settings from anon, authenticated;
revoke all on notes from anon, authenticated;
revoke all on checklist_items from anon, authenticated;
revoke all on guest_categories from anon, authenticated;
revoke all on guests from anon, authenticated;
