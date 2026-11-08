"use server";
import { requireUser } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { createPropertyType, removePropertyType, renamePropertyTypeByKey } from "@/lib/property-types";

export type PropertyTypeState = { error?: string };

const name = (f: FormData) => String(f.get("name") ?? "").trim().slice(0, 60);
const done = () => revalidatePath("/", "layout");

export async function addPropertyType(_: PropertyTypeState, f: FormData): Promise<PropertyTypeState> {
  await requireUser();
  const n = name(f);
  if (!n) return { error: "Name is required." };
  const res = await createPropertyType(n);
  if (res.error) return res;
  done();
  return {};
}

export async function renamePropertyType(f: FormData) {
  await requireUser();
  await renamePropertyTypeByKey(String(f.get("key")), name(f));
  done();
}

export async function deletePropertyType(f: FormData) {
  await requireUser();
  await removePropertyType(String(f.get("key")));
  done();
}
