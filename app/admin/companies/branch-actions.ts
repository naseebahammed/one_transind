"use server";
import { GuardError, requireAdmin } from "@/lib/guard";
import { cleanText, parsePositiveIntId } from "@/lib/input-validation";
import { revalidatePath } from "next/cache";
import { createBranch, setCompanyHasBranches, toggleBranchActive } from "@/lib/branches";

export type BranchState = { error?: string };

export async function addBranch(companyId: number, _: BranchState, f: FormData): Promise<BranchState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const safeCompanyId = parsePositiveIntId(companyId);
  if (!safeCompanyId) return { error: "Company not found." };
  const name = cleanText(f.get("name"), 60);
  if (!name) return { error: "Name is required." };
  const res = await createBranch(safeCompanyId, name);
  if (res.error) return res;
  revalidatePath("/", "layout");
  return {};
}

/** The company-page checkbox. Unchecking only hides the box; the branches and their figures stay on file. */
export async function setHasBranches(f: FormData) {
  await requireAdmin("mutation");
  const id = parsePositiveIntId(f.get("id"));
  if (!id) return;
  await setCompanyHasBranches(id, f.get("enabled") === "on");
  revalidatePath("/", "layout");
}

/** Branches are switched off, never deleted: their figures stay on file. */
export async function toggleBranch(f: FormData) {
  await requireAdmin("mutation");
  const id = parsePositiveIntId(f.get("id"));
  if (!id) return;
  await toggleBranchActive(id);
  revalidatePath("/", "layout");
}
