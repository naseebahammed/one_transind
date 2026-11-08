"use server";
import { revalidatePath } from "next/cache";
import { q, q1 } from "@/lib/db";
import { countCompaniesByPropertyType } from "@/lib/property-types";

export type PropertyTypeState = { error?: string };

const name = (f: FormData) => String(f.get("name") ?? "").trim().slice(0, 60);
const done = () => revalidatePath("/", "layout");

export async function addPropertyType(_: PropertyTypeState, f: FormData): Promise<PropertyTypeState> {
  const n = name(f);
  if (!n) return { error: "Name is required." };
  if (await q1("SELECT 1 FROM app.property_types WHERE lower(name)=lower($1)", [n])) return { error: "A company type with this name already exists." };
  const base = n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "type";
  let key = base;
  for (let i = 2; await q1("SELECT 1 FROM app.property_types WHERE key=$1", [key]); i++) key = `${base}-${i}`;
  await q("INSERT INTO app.property_types(key,name) VALUES($1,$2)", [key, n]);
  done();
  return {};
}

export async function renamePropertyType(f: FormData) {
  const n = name(f), key = String(f.get("key"));
  if (n && !(await q1("SELECT 1 FROM app.property_types WHERE lower(name)=lower($1) AND key<>$2", [n, key]))) await q("UPDATE app.property_types SET name=$1 WHERE key=$2", [n, key]);
  done();
}

export async function deletePropertyType(f: FormData) {
  const key = String(f.get("key"));
  if (await countCompaniesByPropertyType(key)) return; // UI disables the button; this guards a forged request
  await q("DELETE FROM app.property_types WHERE key=$1", [key]);
  done();
}
