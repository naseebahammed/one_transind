"use server";
import { requireUser } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { createAccount, removeAccount, updateAccountById } from "@/lib/accounts";

export type AccountState = { error?: string };

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
const done = () => revalidatePath("/", "layout");

export async function addAccount(_: AccountState, f: FormData): Promise<AccountState> {
  await requireUser();
  const main = text(f, "main"), sub = text(f, "sub");
  if (!main || !sub) return { error: "Main account and sub ledger account are required." };
  const res = await createAccount(main, sub);
  if (res.error) return res;
  done();
  return {};
}

export async function updateAccount(f: FormData): Promise<AccountState> {
  await requireUser();
  const id = Number(f.get("id")), main = text(f, "main"), sub = text(f, "sub");
  if (!Number.isInteger(id) || id <= 0 || !main || !sub) return { error: "Main account and sub ledger account are required." };
  const res = await updateAccountById(id, main, sub);
  if (res.error) return res;
  done();
  return {};
}

export async function deleteAccount(f: FormData) {
  await requireUser();
  const id = Number(f.get("id"));
  if (!Number.isInteger(id)) return;
  await removeAccount(id);
  done();
}
