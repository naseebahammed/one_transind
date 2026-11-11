"use server";
import { revalidatePath } from "next/cache";
import { GuardError, requireAdmin } from "@/lib/guard";
import { cleanText } from "@/lib/input-validation";
import { addUser, removeUser } from "@/lib/users";

export type UserState = { error?: string };

export async function addUserAction(_: UserState, f: FormData): Promise<UserState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const res = await addUser(cleanText(f.get("email"), 200));
  if (res.error) return res;
  revalidatePath("/admin/users");
  return {};
}

export async function removeUserAction(f: FormData) {
  await requireAdmin("mutation");
  const email = cleanText(f.get("email"), 200);
  if (!email) return;
  await removeUser(email);
  revalidatePath("/admin/users");
}
