import { q } from "@/lib/db";

// section 'pnl' is the chart of accounts; the other sections' lines are fixed by migrations.
export type Account = { id: number; main: string; sub: string; used: boolean };

export const listAccounts = () =>
  q<Account>(`SELECT a.id, a.main, a.sub, EXISTS(SELECT 1 FROM app.company_figures f WHERE f.section=a.section AND f.main=a.main AND f.line=a.sub) AS used
    FROM app.accounts a WHERE a.section='pnl' ORDER BY a.main_order, a.id`);

export const listMainAccounts = async () =>
  (await q<{ main: string }>("SELECT main FROM app.accounts WHERE section='pnl' GROUP BY main ORDER BY MIN(main_order), MIN(id)")).map((r) => r.main);
