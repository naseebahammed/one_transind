"use server";
import { GuardError, requireAdmin } from "@/lib/guard";
import { cleanText, parseSlugKey } from "@/lib/input-validation";
import { revalidatePath } from "next/cache";
import { createSector, removeSector, renameSectorByKey } from "@/lib/sectors";

export type SectorState = { error?: string; success?: boolean };

const name = (f: FormData) => cleanText(f.get("name"), 60);
const done = () => revalidatePath("/", "layout");

export async function addSector(_: SectorState, f: FormData): Promise<SectorState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const n = name(f);
  if (!n) return { error: "Name is required." };
  const res = await createSector(n);
  if (res.error) return res;
  done();
  return {};
}

export async function renameSector(_: SectorState, f: FormData): Promise<SectorState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const n = name(f), key = parseSlugKey(f.get("key"));
  if (!key) return { error: "Invalid sector key." };
  if (!n) return { error: "Name is required." };
  const res = await renameSectorByKey(key, n);
  if (res.error) return res;
  done();
  return { success: true };
}

export async function deleteSector(f: FormData) {
  await requireAdmin("mutation");
  const key = parseSlugKey(f.get("key"));
  if (!key) return;
  await removeSector(key);
  done();
}
