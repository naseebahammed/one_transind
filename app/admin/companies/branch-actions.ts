"use server";
import { revalidatePath } from "next/cache";
import { q, q1 } from "@/lib/db";

export type BranchState = { error?: string };

export async function addBranch(companyId: number, _: BranchState, f: FormData): Promise<BranchState> {
  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Name is required." };
  if (!(await q1("SELECT 1 FROM app.companies WHERE id=$1", [companyId]))) return { error: "Company not found." };
  if (await q1("SELECT 1 FROM app.branches WHERE company_id=$1 AND lower(name)=lower($2)", [companyId, name])) return { error: "This company already has a branch with this name." };
  await q("INSERT INTO app.branches(company_id,name) VALUES($1,$2)", [companyId, name]);
  revalidatePath("/admin", "layout");
  return {};
}

/** The company-page checkbox. Unchecking only hides the box; the branches and their figures stay on file. */
export async function setHasBranches(f: FormData) {
  await q("UPDATE app.companies SET has_branches=$1 WHERE id=$2", [f.get("enabled") === "on" ? 1 : 0, Number(f.get("id"))]);
  revalidatePath("/admin", "layout");
}

/** Branches are switched off, never deleted: their figures stay on file. */
export async function toggleBranch(f: FormData) {
  await q("UPDATE app.branches SET active=1-active WHERE id=$1", [Number(f.get("id"))]);
  revalidatePath("/admin", "layout");
}
