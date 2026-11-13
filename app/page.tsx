import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/guard";
import { landingPage } from "@/lib/modules";

export default function Page() {
  return <Suspense fallback={null}><Landing /></Suspense>;
}

async function Landing() {
  const { modules } = await requireUser();
  return redirect(landingPage(modules) ?? "/no-access");
}
