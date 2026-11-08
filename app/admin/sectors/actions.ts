"use server";
import { revalidatePath } from "next/cache";
import { q, q1 } from "@/lib/db";
import { countCompanies, PROTECTED_SECTOR_KEYS } from "@/lib/sectors";

export type SectorState = { error?: string; success?: boolean };

const name = (f: FormData) => String(f.get("name") ?? "").trim().slice(0, 60);
const done = () => revalidatePath("/", "layout");

export async function addSector(_: SectorState, f: FormData): Promise<SectorState> {
  const n = name(f);
  if (!n) return { error: "Name is required." };
  if (await q1("SELECT 1 FROM app.sectors WHERE lower(name)=lower($1)", [n])) return { error: "A sector with this name already exists." };
  const base = n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "sector";
  let key = base;
  for (let i = 2; await q1("SELECT 1 FROM app.sectors WHERE key=$1", [key]); i++) key = `${base}-${i}`;
  await q("INSERT INTO app.sectors(key,name) VALUES($1,$2)", [key, n]);
  done();
  return {};
}

export async function renameSector(_: SectorState, f: FormData): Promise<SectorState> {
  const n = name(f), key = String(f.get("key"));
  if (!n) return { error: "Name is required." };
  if (await q1("SELECT 1 FROM app.sectors WHERE lower(name)=lower($1) AND key<>$2", [n, key])) return { error: "A sector with this name already exists." };
  await q("UPDATE app.sectors SET name=$1 WHERE key=$2", [n, key]);
  done();
  return { success: true };
}

export async function deleteSector(f: FormData) {
  const key = String(f.get("key"));
  if (PROTECTED_SECTOR_KEYS.has(key)) return; // built into the app; UI disables the button, this guards a forged request
  if (await countCompanies(key)) return; // UI disables the button; this guards a forged request
  await q("DELETE FROM app.sectors WHERE key=$1", [key]);
  done();
}
