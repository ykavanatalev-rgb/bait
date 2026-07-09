import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { isAdminEmail } from "@/lib/supabase/config";
import { InfrastructureDashboard } from "@/components/infrastructure/InfrastructureDashboard";

export default async function Page() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/tasks");
  }

  return <InfrastructureDashboard />;
}
