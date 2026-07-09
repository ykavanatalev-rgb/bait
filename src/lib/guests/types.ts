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
