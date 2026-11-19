import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/guard";
import { landingPage } from "@/lib/modules";

export const instant = false;

export default async function Page() {
  // The session check uses random values, so render per request, not at build time.
  await connection();
  const { modules } = await requireUser();
  redirect(landingPage(modules) ?? "/no-access");
}
