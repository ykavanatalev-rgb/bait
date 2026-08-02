export interface GuestCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at?: string;
}

export interface Guest {
  id: string;
  category_id: string;
  name: string;
  /** מספר טלפון מאנשי הקשר / הזנה ידנית */
  phone: string | null;
  /** שם איש הקשר כפי שנבחר במכשיר */
  contact_name: string | null;
  sort_order: number;
  created_at?: string;
}

export interface GuestCategoryWithGuests extends GuestCategory {
  guests: Guest[];
}

export const DEFAULT_GUEST_CATEGORIES = [
  "משפחת קובליו",
  "משפחת קדוש",
  "משפחת קרמר",
  "משפחת גלבך",
  "חברים שירה",
  "חברים יצחק",
] as const;
