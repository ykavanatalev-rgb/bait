import type { ChecklistCategory } from "./types";

export interface SeedItem {
  sub_category: string;
  item_name: string;
  sort_order: number;
}

/** פריטים ישנים שהוחלפו בשורות נפרדות (בשרי / חלבי / פרווה) */
export const DEPRECATED_HOME_ITEMS = [
  "סט סירים (בשרי / חלבי / פרווה)",
  "סט מחבתות (בשרי / חלבי / פרווה)",
  'סכו"ם',
  "צלחות מנות ראשונות",
  "צלחות מנות עיקריות",
  "קערות מרק",
  "כוסות לשתייה קלה",
  "כוסות לשתייה חמה",
  "סכיני שף",
  "קרשי חיתוך (נפרדים לבשרי / חלבי)",
];

function kitchenItems(prefix: "בשרי" | "חלבי" | "פרווה", baseOrder: number): SeedItem[] {
  const sub =
    prefix === "בשרי"
      ? "מטבח · בשרי"
      : prefix === "חלבי"
        ? "מטבח · חלבי"
        : "מטבח · פרווה";

  const items = [
    `סט סירים ${prefix}`,
    `סט מחבתות ${prefix}`,
    `סכו"ם ${prefix}`,
    `צלחות מנות ראשונות ${prefix}`,
    `צלחות מנות עיקריות ${prefix}`,
    `קערות מרק ${prefix}`,
    `כוסות לשתייה קלה ${prefix}`,
    `כוסות לשתייה חמה ${prefix}`,
    `סכיני שף ${prefix}`,
    `קרש חיתוך ${prefix}`,
  ];

  return items.map((item_name, i) => ({
    sub_category: sub,
    item_name,
    sort_order: baseOrder + i,
  }));
}

export const WEDDING_SEED: SeedItem[] = [
  { sub_category: "מקום ואירוע", item_name: "אולם / גן אירועים", sort_order: 1 },
  { sub_category: "מקום ואירוע", item_name: "קייטרינג", sort_order: 2 },
  { sub_category: "מקום ואירוע", item_name: "בר משקאות", sort_order: 3 },
  { sub_category: "מקום ואירוע", item_name: "עיצוב אולם וחופה", sort_order: 4 },
  { sub_category: "מקום ואירוע", item_name: "אישורי הגעה וסידורי הושבה", sort_order: 5 },
  { sub_category: "לבוש וטיפוח", item_name: "שמלת כלה", sort_order: 10 },
  { sub_category: "לבוש וטיפוח", item_name: "חליפת חתן", sort_order: 11 },
  { sub_category: "לבוש וטיפוח", item_name: "נעליים (כלה וחתן)", sort_order: 12 },
  { sub_category: "לבוש וטיפוח", item_name: "איפור ושיער", sort_order: 13 },
  { sub_category: "לבוש וטיפוח", item_name: "תכשיטים", sort_order: 14 },
  { sub_category: "לבוש וטיפוח", item_name: "טבעות נישואין", sort_order: 15 },
  { sub_category: "ספקים", item_name: "צלם (סטילס ווידאו)", sort_order: 20 },
  { sub_category: "ספקים", item_name: "מגנטים", sort_order: 21 },
  { sub_category: "ספקים", item_name: "דיג'יי / להקה", sort_order: 22 },
  { sub_category: "ספקים", item_name: "רב / מחתן", sort_order: 23 },
  { sub_category: "ספקים", item_name: "פגישות הדרכת כלות / חתנים", sort_order: 24 },
  { sub_category: "מסביב", item_name: "הזמנות לחתונה (מודפסות / דיגיטליות)", sort_order: 30 },
  { sub_category: "מסביב", item_name: "מתנות לאורחים", sort_order: 31 },
  { sub_category: "מסביב", item_name: "רכב לחתונה", sort_order: 32 },
  { sub_category: "מסביב", item_name: "מלון לליל הכלולות", sort_order: 33 },
  { sub_category: "דת ובירוקרטיה", item_name: "פתיחת תיק ברבנות", sort_order: 40 },
  { sub_category: "דת ובירוקרטיה", item_name: "תעודת רווקות", sort_order: 41 },
  { sub_category: "דת ובירוקרטיה", item_name: "כתובה", sort_order: 42 },
  { sub_category: "דת ובירוקרטיה", item_name: "טלית", sort_order: 43 },
];

export const HOME_SEED: SeedItem[] = [
  { sub_category: "מטבח · מוצרי חשמל", item_name: "מקרר", sort_order: 1 },
  { sub_category: "מטבח · מוצרי חשמל", item_name: "תנור", sort_order: 2 },
  { sub_category: "מטבח · מוצרי חשמל", item_name: "מיקרוגל", sort_order: 3 },
  { sub_category: "מטבח · מוצרי חשמל", item_name: "כיריים", sort_order: 4 },
  { sub_category: "מטבח · מוצרי חשמל", item_name: "קומקום", sort_order: 5 },
  { sub_category: "מטבח · מוצרי חשמל", item_name: "מדיח כלים", sort_order: 6 },
  ...kitchenItems("בשרי", 10),
  ...kitchenItems("חלבי", 20),
  ...kitchenItems("פרווה", 30),
  { sub_category: "מטבח · כללי", item_name: "קופסאות אחסון", sort_order: 40 },
  { sub_category: "מטבח · כללי", item_name: "פח אשפה", sort_order: 41 },
  { sub_category: "סלון", item_name: "מערכת ישיבה (ספה)", sort_order: 50 },
  { sub_category: "סלון", item_name: "שולחן סלון", sort_order: 51 },
  { sub_category: "סלון", item_name: "מזנון", sort_order: 52 },
  { sub_category: "סלון", item_name: "טלוויזיה", sort_order: 53 },
  { sub_category: "סלון", item_name: "גופי תאורה", sort_order: 54 },
  { sub_category: "סלון", item_name: "שטיח", sort_order: 55 },
  { sub_category: "סלון", item_name: "וילונות", sort_order: 56 },
  { sub_category: "סלון", item_name: "מדפים / ספרייה", sort_order: 57 },
  { sub_category: "חדר שינה", item_name: "מיטה ומזרן", sort_order: 60 },
  { sub_category: "חדר שינה", item_name: "ארון בגדים גדול", sort_order: 61 },
  { sub_category: "חדר שינה", item_name: "שידות לילה", sort_order: 62 },
  { sub_category: "חדר שינה", item_name: "מצעים (סטים להחלפה)", sort_order: 63 },
  { sub_category: "חדר שינה", item_name: "כריות ושמיכות", sort_order: 64 },
  { sub_category: "חדר שינה", item_name: "מראה", sort_order: 65 },
  { sub_category: "חדר ארונות / שירות", item_name: "מכונת כביסה", sort_order: 70 },
  { sub_category: "חדר ארונות / שירות", item_name: "מייבש", sort_order: 71 },
  { sub_category: "חדר ארונות / שירות", item_name: "מגהץ וקרש גיהוץ", sort_order: 72 },
  { sub_category: "חדר ארונות / שירות", item_name: "חומרי ניקוי", sort_order: 73 },
  { sub_category: "חדר ארונות / שירות", item_name: "מטאטא ויעה", sort_order: 74 },
  { sub_category: "חדר ארונות / שירות", item_name: "שואב אבק", sort_order: 75 },
  { sub_category: "חדר ארונות / שירות", item_name: "סל כביסה", sort_order: 76 },
  { sub_category: "אמבטיה ושירותים", item_name: "מגבות גוף", sort_order: 80 },
  { sub_category: "אמבטיה ושירותים", item_name: "מגבות פנים", sort_order: 81 },
  { sub_category: "אמבטיה ושירותים", item_name: "מגבות ידיים", sort_order: 82 },
  { sub_category: "אמבטיה ושירותים", item_name: "שטיח לאמבטיה", sort_order: 83 },
  { sub_category: "אמבטיה ושירותים", item_name: "וילון אמבטיה", sort_order: 84 },
  { sub_category: "אמבטיה ושירותים", item_name: "מתקן למברשות שיניים", sort_order: 85 },
  { sub_category: "אמבטיה ושירותים", item_name: "מברשת לאסלה", sort_order: 86 },
];

export const HENNA_SEED: SeedItem[] = [
  { sub_category: "מקום ואירוע", item_name: "אולם / גן לאירוע חינה", sort_order: 1 },
  { sub_category: "מקום ואירוע", item_name: "קייטרינג", sort_order: 2 },
  { sub_category: "מקום ואירוע", item_name: "בר משקאות", sort_order: 3 },
  { sub_category: "מקום ואירוע", item_name: "עיצוב וקישוטים", sort_order: 4 },
  { sub_category: "מקום ואירוע", item_name: "סידורי הושבה", sort_order: 5 },
  { sub_category: "מקום ואירוע", item_name: "תאורה וסאונד", sort_order: 6 },
  { sub_category: "לבוש וטיפוח", item_name: "שמלת חינה", sort_order: 10 },
  { sub_category: "לבוש וטיפוח", item_name: "תכשיטים", sort_order: 11 },
  { sub_category: "לבוש וטיפוח", item_name: "איפור ושיער", sort_order: 12 },
  { sub_category: "לבוש וטיפוח", item_name: "נעליים", sort_order: 13 },
  { sub_category: "לבוש וטיפוח", item_name: "חינה על הידיים", sort_order: 14 },
  { sub_category: "לבוש וטיפוח", item_name: "מקעקע חינה מקצועי", sort_order: 15 },
  { sub_category: "מוזיקה ואווירה", item_name: "דיג'יי / להקה", sort_order: 20 },
  { sub_category: "מוזיקה ואווירה", item_name: "תאורה מיוחדת", sort_order: 21 },
  { sub_category: "מוזיקה ואווירה", item_name: "מנחה לאירוע", sort_order: 22 },
  { sub_category: "צילום וזיכרונות", item_name: "צלם / וידאו", sort_order: 30 },
  { sub_category: "צילום וזיכרונות", item_name: "מגנטים", sort_order: 31 },
  { sub_category: "צילום וזיכרונות", item_name: "עמדת צילום", sort_order: 32 },
  { sub_category: "הזמנות ואורחים", item_name: "הזמנות לחינה", sort_order: 40 },
  { sub_category: "הזמנות ואורחים", item_name: "רשימת מוזמנים לחינה", sort_order: 41 },
  { sub_category: "הזמנות ואורחים", item_name: "מתנות לאורחים", sort_order: 42 },
  { sub_category: "הזמנות ואורחים", item_name: "אישורי הגעה", sort_order: 43 },
  { sub_category: "הסעות ולוגיסטיקה", item_name: "חניה / הסעות", sort_order: 50 },
  { sub_category: "הסעות ולוגיסטיקה", item_name: "אבטחה", sort_order: 51 },
  { sub_category: "הסעות ולוגיסטיקה", item_name: "חוזים ומקדמות לספקים", sort_order: 52 },
];

export function getSeedForCategory(category: ChecklistCategory): SeedItem[] {
  if (category === "wedding") return WEDDING_SEED;
  if (category === "henna") return HENNA_SEED;
  return HOME_SEED;
}

export const HOME_TABS: { id: string; label: string; subCategories: string[] }[] = [
  { id: "kitchen-appliances", label: "מטבח · חשמל", subCategories: ["מטבח · מוצרי חשמל"] },
  { id: "kitchen-meat", label: "מטבח · בשרי", subCategories: ["מטבח · בשרי"] },
  { id: "kitchen-dairy", label: "מטבח · חלבי", subCategories: ["מטבח · חלבי"] },
  { id: "kitchen-parve", label: "מטבח · פרווה", subCategories: ["מטבח · פרווה"] },
  { id: "kitchen-general", label: "מטבח · כללי", subCategories: ["מטבח · כללי"] },
  { id: "living", label: "סלון", subCategories: ["סלון"] },
  { id: "bedroom", label: "חדר שינה", subCategories: ["חדר שינה"] },
  { id: "laundry", label: "ארונות / שירות", subCategories: ["חדר ארונות / שירות"] },
  { id: "bathroom", label: "אמבטיה", subCategories: ["אמבטיה ושירותים"] },
];
