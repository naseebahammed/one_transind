"use client";
import { useState } from "react";
import { uploadPosReports } from "@/app/admin/retail/actions";

const BATCH_BYTES = 6 * 1024 * 1024, BATCH_FILES = 12, PAUSE_MS = 6000; // the server allows 12 uploads a minute

/** Takes any number of monthly POS reports and sends them in small batches, one after another, so a whole year can be dropped at once. Safe to repeat: a month is replaced, not added. */
export function UploadPosReports() {
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({ text: "" });
  const [busy, setBusy] = useState(false);

  async function send(files: File[]) {
    const batches: File[][] = [[]];
    let bytes = 0;
    for (const file of files) {
      if (bytes + file.size > BATCH_BYTES || batches[batches.length - 1].length >= BATCH_FILES) { batches.push([]); bytes = 0; }
      batches[batches.length - 1].push(file); bytes += file.size;
    }
    setBusy(true);
    let done = 0; const problems: string[] = [];
    for (const [i, batch] of batches.entries()) {
      setStatus({ text: `Uploading ${done} of ${files.length} files...` });
      const body = new FormData();
      batch.forEach((file) => body.append("file", file));
      const result = await uploadPosReports({}, body);
      done += result.saved ?? 0;
      if (result.error) problems.push(result.error);
      if (result.saved === undefined) break; // blocked as a whole (busy, rate limit, size), not a bad file: stop and let the user retry
      if (i < batches.length - 1) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    setBusy(false);
    setStatus({ text: `Saved ${done} of ${files.length} files.${problems.length ? ` ${problems.slice(0, 3).join(" ")}` : ""}`, error: problems.length > 0 });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input type="file" multiple accept=".xls,.csv" disabled={busy} aria-label="POS report files" onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) void send(files); }} />
      {status.text && <span role={status.error ? "alert" : "status"} className={status.error ? "text-destructive" : "text-success"}>{status.text}</span>}
    </div>
  );
}
