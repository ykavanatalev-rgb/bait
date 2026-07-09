import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/supabase/auth-server";
import { TasksPage } from "@/components/tasks/TasksPage";

export default async function Page() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/");
  }

  return <TasksPage />;
}
