import { q, q1 } from "@/lib/db";

// section 'pnl' is the chart of accounts; the other sections' lines are fixed by migrations.
export type Account = { id: number; main: string; sub: string; used: boolean };

export const listAccounts = () =>
  q<Account>(`SELECT a.id, a.main, a.sub, EXISTS(SELECT 1 FROM app.company_figures f WHERE f.section=a.section AND f.main=a.main AND f.line=a.sub) AS used
    FROM app.accounts a WHERE a.section='pnl' ORDER BY a.main_order, a.id`);

const taken = async (main: string, sub: string, id = 0) =>
  !!(await q1("SELECT 1 FROM app.accounts WHERE section='pnl' AND lower(main)=lower($1) AND lower(sub)=lower($2) AND id<>$3", [main, sub, id]));

// A main account keeps the position of its existing rows; a new one goes last.
const orderOf = async (main: string) =>
  (await q1<{ o: number }>("SELECT COALESCE((SELECT main_order FROM app.accounts WHERE section='pnl' AND lower(main)=lower($1) LIMIT 1), (SELECT COALESCE(MAX(main_order),0)+1 FROM app.accounts WHERE section='pnl')) AS o", [main]))!.o;

export async function createAccount(main: string, sub: string): Promise<{ error?: string }> {
  if (await taken(main, sub)) return { error: "This sub ledger account already exists under that main account." };
  await q("INSERT INTO app.accounts(main,sub,main_order) VALUES($1,$2,$3)", [main, sub, await orderOf(main)]);
  return {};
}

export async function updateAccountById(id: number, main: string, sub: string): Promise<{ error?: string }> {
  if (await taken(main, sub, id)) return { error: "This sub ledger account already exists under that main account." };
  await q("UPDATE app.accounts SET main=$1, sub=$2, main_order=$3 WHERE id=$4 AND section='pnl'", [main, sub, await orderOf(main), id]);
  return {};
}

export async function removeAccount(id: number) {
  await q("DELETE FROM app.accounts a WHERE a.id=$1 AND a.section='pnl' AND NOT EXISTS(SELECT 1 FROM app.company_figures f WHERE f.section=a.section AND f.main=a.main AND f.line=a.sub)", [id]);
}
