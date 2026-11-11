"use server";
import { GuardError, requireAdmin } from "@/lib/guard";
import { cleanText, parsePositiveIntId } from "@/lib/input-validation";
import { revalidatePath, updateTag } from "next/cache";
import { createAccount, removeAccount, updateAccountById } from "@/lib/accounts";
import { REPORTS_CACHE_TAG } from "@/lib/reports";

export type AccountState = { error?: string };

const text = (f: FormData, k: string) => cleanText(f.get(k), 80);
const done = () => {
  updateTag(REPORTS_CACHE_TAG);
  revalidatePath("/", "layout");
};

export async function addAccount(_: AccountState, f: FormData): Promise<AccountState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const main = text(f, "main"), sub = text(f, "sub");
  if (!main || !sub) return { error: "Main account and sub ledger account are required." };
  const res = await createAccount(main, sub);
  if (res.error) return res;
  done();
  return {};
}

export async function updateAccount(f: FormData): Promise<AccountState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const id = parsePositiveIntId(f.get("id")), main = text(f, "main"), sub = text(f, "sub");
  if (!id || !main || !sub) return { error: "Main account and sub ledger account are required." };
  const res = await updateAccountById(id, main, sub);
  if (res.error) return res;
  done();
  return {};
}

export async function deleteAccount(f: FormData) {
  await requireAdmin("mutation");
  const id = parsePositiveIntId(f.get("id"));
  if (!id) return;
  await removeAccount(id);
  done();
}
