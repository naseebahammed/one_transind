"use server";
import { GuardError, requireAdmin } from "@/lib/guard";
import { cleanText, parseSlugKey } from "@/lib/input-validation";
import { revalidatePath } from "next/cache";
import { createPropertyType, removePropertyType, renamePropertyTypeByKey } from "@/lib/property-types";

export type PropertyTypeState = { error?: string };

const name = (f: FormData) => cleanText(f.get("name"), 60);
const done = () => revalidatePath("/", "layout");

export async function addPropertyType(_: PropertyTypeState, f: FormData): Promise<PropertyTypeState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const n = name(f);
  if (!n) return { error: "Name is required." };
  const res = await createPropertyType(n);
  if (res.error) return res;
  done();
  return {};
}

export async function renamePropertyType(f: FormData) {
  await requireAdmin("mutation");
  const key = parseSlugKey(f.get("key"));
  if (!key) return;
  await renamePropertyTypeByKey(key, name(f));
  done();
}

export async function deletePropertyType(f: FormData) {
  await requireAdmin("mutation");
  const key = parseSlugKey(f.get("key"));
  if (!key) return;
  await removePropertyType(key);
  done();
}
