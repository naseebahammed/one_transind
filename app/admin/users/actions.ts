"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/guard";
import { addUser, removeUser } from "@/lib/users";

export type UserState = { error?: string };

export async function addUserAction(_: UserState, f: FormData): Promise<UserState> {
  await requireAdmin();
  const res = await addUser(String(f.get("email") ?? "").slice(0, 200));
  if (res.error) return res;
  revalidatePath("/admin/users");
  return {};
}

export async function removeUserAction(f: FormData) {
  await requireAdmin();
  await removeUser(String(f.get("email") ?? ""));
  revalidatePath("/admin/users");
}
