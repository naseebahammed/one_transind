import { q, q1 } from "@/lib/db";

export type Branch = { id: number; name: string; active: number };

export const listBranches = (companyId: number) =>
  q<Branch>("SELECT id, name, active FROM app.branches WHERE company_id=$1 ORDER BY lower(name)", [companyId]);

/** Branch id from a form or URL: null = the whole company, undefined = not a branch of this company (refuse the request). */
export async function branchOf(companyId: number, raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id)) return undefined;
  return (await q1("SELECT 1 FROM app.branches WHERE id=$1 AND company_id=$2", [id, companyId])) ? id : undefined;
}

export const branchName = async (id: number) => (await q1<{ name: string }>("SELECT name FROM app.branches WHERE id=$1", [id]))?.name ?? "";
