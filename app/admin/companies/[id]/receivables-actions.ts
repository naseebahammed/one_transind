"use server";
import { revalidatePath } from "next/cache";
import { getCompany } from "@/lib/companies";
import { addLog } from "@/lib/db";
import { GuardError, requireAdmin } from "@/lib/guard";
import { parsePositiveIntId } from "@/lib/input-validation";
import { parseManualReceivablesSnapshot } from "@/lib/manual-entry-input";
import { deleteReceivablesSnapshot, saveReceivablesSnapshot } from "@/lib/manual-report-records";
import { SECTOR } from "@/lib/org";

export type CompanyReceivablesState = { error?: string; ok?: string };

function refreshReceivablesPaths(companyId: number) {
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/manual-entry");
  revalidatePath("/admin/data-status");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

export async function saveCompanyReceivablesAction(
  _: CompanyReceivablesState,
  formData: FormData,
): Promise<CompanyReceivablesState> {
  try {
    await requireAdmin("mutation");
  } catch (err) {
    if (err instanceof GuardError) return { error: err.message };
    throw err;
  }

  const parsed = parseManualReceivablesSnapshot(formData);
  if ("error" in parsed) return parsed;
  if (!parsed.data.companyId) return { error: "Company is required." };

  const company = await getCompany(parsed.data.companyId);
  if (!company) return { error: "Company not found." };
  if (company.sector === SECTOR.trading) {
    return { error: "Trading receivables are read directly from the ERP view." };
  }

  await saveReceivablesSnapshot({ ...parsed.data, companyId: company.id });
  await addLog(`${company.name}: receivables aging snapshot (${parsed.data.asOf}) saved`);
  refreshReceivablesPaths(company.id);
  return { ok: `Saved receivables aging snapshot as of ${parsed.data.asOf}.` };
}

export async function clearCompanyReceivablesAction(formData: FormData): Promise<void> {
  await requireAdmin("mutation");
  const snapshotId = parsePositiveIntId(formData.get("snapshotId"));
  const companyId = parsePositiveIntId(formData.get("companyId"));
  if (!snapshotId || !companyId) return;
  const company = await getCompany(companyId);
  if (!company) return;
  await deleteReceivablesSnapshot(snapshotId);
  await addLog(`${company.name}: cleared receivables aging snapshot`);
  refreshReceivablesPaths(company.id);
}

