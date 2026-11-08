"use server";
import { requireUser } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { createBranch, setCompanyHasBranches, toggleBranchActive } from "@/lib/branches";

export type BranchState = { error?: string };

export async function addBranch(companyId: number, _: BranchState, f: FormData): Promise<BranchState> {
  await requireUser();
  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Name is required." };
  const res = await createBranch(companyId, name);
  if (res.error) return res;
  revalidatePath("/", "layout");
  return {};
}

/** The company-page checkbox. Unchecking only hides the box; the branches and their figures stay on file. */
export async function setHasBranches(f: FormData) {
  await requireUser();
  const id = Number(f.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await setCompanyHasBranches(id, f.get("enabled") === "on");
  revalidatePath("/", "layout");
}

/** Branches are switched off, never deleted: their figures stay on file. */
export async function toggleBranch(f: FormData) {
  await requireUser();
  const id = Number(f.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await toggleBranchActive(id);
  revalidatePath("/", "layout");
}
