"use server";
import { revalidatePath } from "next/cache";
import { addLog } from "@/lib/db";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { posGridFromFile } from "@/lib/pos-file";
import { parsePosReport } from "@/lib/pos-reports";
import { savePosReport } from "@/lib/pos-reports-records";
import { sanitizeUploadFileName } from "@/lib/upload-security";

export type PosUploadState = { error?: string; ok?: string; saved?: number };

const MAX_FILES_PER_REQUEST = 12;
const MAX_REQUEST_BYTES = 7 * 1024 * 1024; // the server action body limit is 8 MB

/** Loads monthly POS reports (.xls or .csv) for Dukan Foods and Top Perfumes. Each file is checked on its own and replaces its company's month; a bad file is skipped and named, the good ones are kept. */
export async function uploadPosReports(_: PosUploadState, f: FormData): Promise<PosUploadState> {
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
      if (!files.length) return { error: "Choose the report files (.xls or .csv)." };
      if (files.length > MAX_FILES_PER_REQUEST || files.reduce((a, x) => a + x.size, 0) > MAX_REQUEST_BYTES) return { error: `Send at most ${MAX_FILES_PER_REQUEST} files and 7 MB at a time.` };
      let rows = 0; const saved: string[] = [], failed: string[] = [];
      for (const file of files) {
        const name = sanitizeUploadFileName(file.name);
        try {
          const report = parsePosReport(posGridFromFile(Buffer.from(await file.arrayBuffer())));
          if (report.errors.length) throw new Error(report.errors.slice(0, 3).join(" "));
          rows += await savePosReport(report);
          saved.push(`${report.entity} ${report.kind} ${report.period.slice(0, 7)}`);
        } catch (e) {
          failed.push(`${name}: ${(e as Error).message}`);
        }
      }
      await addLog(`POS reports uploaded (${saved.length} of ${files.length} files)`, failed.length === 0, rows);
      revalidatePath("/retail/pos"); revalidatePath("/admin/activity");
      const ok = saved.length ? `Saved ${saved.length} file${saved.length > 1 ? "s" : ""} (${rows} rows).` : undefined;
      return failed.length ? { ok, saved: saved.length, error: `${failed.length} file${failed.length > 1 ? "s" : ""} refused. ${failed.slice(0, 3).join(" | ")}` } : { ok, saved: saved.length };
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}
