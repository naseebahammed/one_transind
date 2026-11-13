import { redirect } from "next/navigation";
import { requireUser } from "@/lib/guard";
import { landingPage } from "@/lib/modules";

export default async function Page() {
  const { modules } = await requireUser();
  redirect(landingPage(modules) ?? "/no-access");
}
