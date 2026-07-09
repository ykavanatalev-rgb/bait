import { ChecklistPage } from "@/components/checklist/ChecklistPage";

export default function HomeCategoryPage() {
  return (
    <ChecklistPage
      config={{
        category: "home",
        title: "בית",
        subtitle: "ציוד וריהוט לפי חדרים",
        backHref: "/",
        accent: "emerald",
      }}
      useTabs
    />
  );
}
