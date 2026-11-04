"use server";
import { revalidatePath } from "next/cache";
import { q, q1 } from "@/lib/db";

export type AccountState = { error?: string };

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
const done = () => revalidatePath("/admin", "layout");
const taken = async (main: string, sub: string, id = 0) =>
  !!(await q1("SELECT 1 FROM app.accounts WHERE lower(main)=lower($1) AND lower(sub)=lower($2) AND id<>$3", [main, sub, id]));

// A main account keeps the position of its existing rows; a new one goes last.
const orderOf = async (main: string) =>
  (await q1<{ o: number }>("SELECT COALESCE((SELECT main_order FROM app.accounts WHERE lower(main)=lower($1) LIMIT 1), (SELECT COALESCE(MAX(main_order),0)+1 FROM app.accounts)) AS o", [main]))!.o;

export async function addAccount(_: AccountState, f: FormData): Promise<AccountState> {
  const main = text(f, "main"), sub = text(f, "sub");
  if (!main || !sub) return { error: "Main account and sub ledger account are required." };
  if (await taken(main, sub)) return { error: "This sub ledger account already exists under that main account." };
  await q("INSERT INTO app.accounts(main,sub,main_order) VALUES($1,$2,$3)", [main, sub, await orderOf(main)]);
  done();
  return {};
}

export async function updateAccount(f: FormData): Promise<AccountState> {
  const id = Number(f.get("id")), main = text(f, "main"), sub = text(f, "sub");
  if (!id || !main || !sub) return { error: "Main account and sub ledger account are required." };
  if (await taken(main, sub, id)) return { error: "This sub ledger account already exists under that main account." };
  await q("UPDATE app.accounts SET main=$1, sub=$2, main_order=$3 WHERE id=$4", [main, sub, await orderOf(main), id]);
  done();
  return {};
}

export async function deleteAccount(f: FormData) {
  await q("DELETE FROM app.accounts WHERE id=$1", [Number(f.get("id"))]);
  done();
}
