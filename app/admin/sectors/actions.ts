"use server";
import { requireAdmin } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { createSector, removeSector, renameSectorByKey } from "@/lib/sectors";

export type SectorState = { error?: string; success?: boolean };

const name = (f: FormData) => String(f.get("name") ?? "").trim().slice(0, 60);
const done = () => revalidatePath("/", "layout");

export async function addSector(_: SectorState, f: FormData): Promise<SectorState> {
  await requireAdmin();
  const n = name(f);
  if (!n) return { error: "Name is required." };
  const res = await createSector(n);
  if (res.error) return res;
  done();
  return {};
}

export async function renameSector(_: SectorState, f: FormData): Promise<SectorState> {
  await requireAdmin();
  const n = name(f), key = String(f.get("key"));
  if (!n) return { error: "Name is required." };
  const res = await renameSectorByKey(key, n);
  if (res.error) return res;
  done();
  return { success: true };
}

export async function deleteSector(f: FormData) {
  await requireAdmin();
  await removeSector(String(f.get("key")));
  done();
}
