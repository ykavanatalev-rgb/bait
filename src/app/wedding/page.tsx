import { ChecklistPage } from "@/components/checklist/ChecklistPage";

export default function WeddingPage() {
  return (
    <ChecklistPage
      config={{
        category: "wedding",
        title: "חתונה",
        subtitle: "רשימת משימות ותקציב — מא׳ ועד ת׳",
        backHref: "/",
        accent: "rose",
      }}
    />
  );
}
