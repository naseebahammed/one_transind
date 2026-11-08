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

export async function createBranch(companyId: number, name: string): Promise<{ error?: string }> {
  if (!(await q1("SELECT 1 FROM app.companies WHERE id=$1", [companyId]))) return { error: "Company not found." };
  if (await q1("SELECT 1 FROM app.branches WHERE company_id=$1 AND lower(name)=lower($2)", [companyId, name])) return { error: "This company already has a branch with this name." };
  await q("INSERT INTO app.branches(company_id,name) VALUES($1,$2)", [companyId, name]);
  return {};
}

export const setCompanyHasBranches = (companyId: number, enabled: boolean) =>
  q("UPDATE app.companies SET has_branches=$1 WHERE id=$2", [enabled ? 1 : 0, companyId]);

export const toggleBranchActive = (branchId: number) =>
  q("UPDATE app.branches SET active=1-active WHERE id=$1", [branchId]);
