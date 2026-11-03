import { q } from "@/lib/db";

export type Account = { id: number; main: string; sub: string };

export const listAccounts = () => q<Account>("SELECT id, main, sub FROM app.accounts ORDER BY main_order, id");

export const listMainAccounts = async () =>
  (await q<{ main: string }>("SELECT main FROM app.accounts GROUP BY main ORDER BY MIN(main_order), MIN(id)")).map((r) => r.main);
