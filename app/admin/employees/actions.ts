"use server";
import { revalidatePath } from "next/cache";
import { readWorkbook, gridFromWorkbook, MAX_UPLOAD_BYTES } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { addDepartment, addStaffDepartment, linkSourceName, listSourceNames, removeDepartment, renameDepartment, saveEmployees } from "@/lib/employee-records";
import { mergeEmployees, parseEmployees, type Employee } from "@/lib/employees";
import { saveSettlements } from "@/lib/settlement-records";
import { parseSettlements } from "@/lib/settlements";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { cleanText, parsePositiveIntId } from "@/lib/input-validation";
import { sanitizeUploadFileName } from "@/lib/upload-security";

export type EmployeeUploadState = { error?: string; ok?: string };

const MAX_EMPLOYEE_FILES = 10;

/** Reads the new-hires and/or leavers file. Any bad row refuses that whole file, so nothing half-loads. */
export async function uploadEmployees(_: EmployeeUploadState, f: FormData): Promise<EmployeeUploadState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }

  try {
    return await withUploadSlot(admin.email, async () => {
      const files = f.getAll("file").filter((x): x is File => x instanceof File && x.size > 0);
      if (!files.length) return { error: "Choose the staff list .xlsx file(s)." };
      if (files.length > MAX_EMPLOYEE_FILES) return { error: `Upload at most ${MAX_EMPLOYEE_FILES} files at a time.` };
      if (files.some((x) => x.size > MAX_UPLOAD_BYTES)) return { error: "Each file must be under 7 MB." };
      const all: Employee[] = [], skipped = new Set<string>();
      try {
        for (const file of files) {
          const safeName = sanitizeUploadFileName(file.name);
          const { employees, errors, skipped: bad } = parseEmployees(gridFromWorkbook(await readWorkbook(Buffer.from(await file.arrayBuffer()))));
          if (errors.length) throw new Error(`${safeName}: ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` (and ${errors.length - 5} more)` : ""}`);
          all.push(...employees); bad.forEach((x) => skipped.add(x));
        }
        const n = await saveEmployees(mergeEmployees(all));
        await addLog(`Staff lists uploaded (${files.length} file${files.length > 1 ? "s" : ""})`, true, n);
        revalidatePath("/hr"); revalidatePath("/admin/activity");
        return { ok: `Saved ${n} employee rows.${skipped.size ? ` Skipped: ${[...skipped].join("; ")}.` : ""}` };
      } catch (e) {
        await addLog("Staff lists rejected", false, 0);
        revalidatePath("/admin/activity");
        return { error: (e as Error).message };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}

const refresh = () => { revalidatePath("/admin/employees"); revalidatePath("/hr"); revalidatePath("/admin/companies/[id]", "page"); };

export async function createDepartment(f: FormData) {
  await requireAdmin("mutation");
  const companyId = parsePositiveIntId(f.get("companyId")), name = cleanText(f.get("name"), 80);
  if (!companyId || !name) return;
  await addDepartment(companyId, name);
  refresh();
}

export async function deleteDepartment(f: FormData) {
  await requireAdmin("mutation");
  const id = parsePositiveIntId(f.get("id"));
  if (id) { await removeDepartment(id); refresh(); }
}

/** An empty or unknown department id unlinks the name. */
export async function linkDepartment(f: FormData) {
  await requireAdmin("mutation");
  const name = cleanText(f.get("name"), 80);
  if (!name) return;
  await linkSourceName(name, parsePositiveIntId(f.get("departmentId")));
  refresh();
}

/** Adds a department to a company by choosing one of the names found in the staff lists. */
export async function addStaffDepartmentAction(f: FormData) {
  await requireAdmin("mutation");
  const companyId = parsePositiveIntId(f.get("companyId")), name = cleanText(f.get("name"), 80);
  if (!companyId || !name || !(await listSourceNames()).some((n) => n.name === name)) return;
  await addStaffDepartment(companyId, name);
  refresh();
}

export async function renameDepartmentAction(f: FormData) {
  await requireAdmin("mutation");
  const id = parsePositiveIntId(f.get("id")), name = cleanText(f.get("name"), 80);
  if (!id || !name) return;
  await renameDepartment(id, name);
  refresh();
}

/** Reads the settlements ledger (one file). Any bad row refuses the file; dates already on file are replaced. */
export async function uploadSettlements(_: EmployeeUploadState, f: FormData): Promise<EmployeeUploadState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  try {
    return await withUploadSlot(admin.email, async () => {
      const file = f.get("file");
      if (!(file instanceof File) || !file.size) return { error: "Choose the settlements .xlsx file." };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB." };
      try {
        const { settlements, errors } = parseSettlements(gridFromWorkbook(await readWorkbook(Buffer.from(await file.arrayBuffer()))));
        if (errors.length) throw new Error(`${sanitizeUploadFileName(file.name)}: ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` (and ${errors.length - 5} more)` : ""}`);
        const n = await saveSettlements(settlements);
        await addLog("Settlements uploaded", true, n);
        revalidatePath("/hr/settlements"); revalidatePath("/admin/activity");
        return { ok: `Saved ${n} settlement payments.` };
      } catch (e) {
        await addLog("Settlements rejected", false, 0);
        revalidatePath("/admin/activity");
        return { error: (e as Error).message };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}
