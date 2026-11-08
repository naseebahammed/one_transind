import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { listedEmails } from "@/lib/users";

async function who() {
  const email = (await auth())?.user?.email;
  return { email, role: await currentRole(email, listedEmails) };
}

/** Call first in every page, layout and Server Action. The list is re-read each time, so removing someone takes effect on their next request. */
export async function requireUser() {
  const { email, role } = await who();
  if (!email) redirect("/signin");
  if (!role) redirect("/no-access");
  return { email, role };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/no-access");
  return user;
}

/** Call first in every route handler: returns a 401 response to send back, or null when the caller may continue. */
export async function apiGuard() {
  return (await who()).role ? null : Response.json({ error: "Sign in required" }, { status: 401 });
}
