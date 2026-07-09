import { ChecklistPage } from "@/components/checklist/ChecklistPage";

export default function HennaPage() {
  return (
    <ChecklistPage
      config={{
        category: "henna",
        title: "חינה",
        subtitle: "רשימת משימות ותקציב לאירוע החינה",
        backHref: "/",
        accent: "amber",
      }}
    />
  );
}
