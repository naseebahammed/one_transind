// Pure server-side file-signature, SVG sanitization, filename, and ZIP-bomb inspection helpers (zero external dependencies).

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_XLSX_ENTRIES = 250;
export const MAX_XLSX_SINGLE_ENTRY_BYTES = 25 * 1024 * 1024;
export const MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const MAX_CSV_LINES = 50_000;

const DANGEROUS_SVG_PATTERN =
  /<!(?:doctype|entity)\b|<\s*(?:script|foreignobject|iframe|object|embed|applet|meta|link|base|audio|video)\b|\bon[a-z]+\s*=|(?:javascript|vbscript|data\s*:\s*text\/html)\s*:|(?:xlink:href|href|src)\s*=\s*["']?\s*(?:https?:|\/\/)|url\(\s*["']?\s*(?:https?:|\/\/)/i;

/** Sanitizes an uploaded filename so directory traversal, null bytes, and control characters never enter logs, DB, or headers. */
export function sanitizeUploadFileName(rawName: unknown): string {
  if (typeof rawName !== "string") return "upload";
  const baseName = rawName.split(/[\\/]/).pop() ?? "";
  const cleaned = baseName
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return cleaned || "upload";
}

function isPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isGif(buf: Buffer): boolean {
  if (buf.length < 6) return false;
  const header = buf.subarray(0, 6).toString("ascii");
  return header === "GIF87a" || header === "GIF89a";
}

function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function isSafeSvg(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  const text = buf.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (text.length < 12 || text.length > MAX_LOGO_BYTES) return false;
  // Must start with XML declaration, comment, or <svg directly — never HTML wrapper polyglots
  if (!/^(?:<\?xml\b[^>]*\?>\s*|<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return false;
  if (!/(?:<\/svg\s*>|\/>)\s*$/i.test(text)) return false;
  if (DANGEROUS_SVG_PATTERN.test(text)) return false;
  return true;
}

/**
 * Verifies an uploaded company logo from its actual magic bytes and content rather than client-claimed File.type.
 * Returns the canonical server-verified MIME type when safe, or a readable error message.
 */
export function inspectLogoUpload(
  buf: Buffer,
  maxBytes: number = MAX_LOGO_BYTES,
): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (!buf.length) return { ok: false, error: "Logo file is empty." };
  if (buf.length > maxBytes) return { ok: false, error: "Logo must be under 2MB." };

  if (isPng(buf)) return { ok: true, mimeType: "image/png" };
  if (isJpeg(buf)) return { ok: true, mimeType: "image/jpeg" };
  if (isGif(buf)) return { ok: true, mimeType: "image/gif" };
  if (isWebp(buf)) return { ok: true, mimeType: "image/webp" };

  const head = buf.subarray(0, 512).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!--")) {
    if (isSafeSvg(buf)) return { ok: true, mimeType: "image/svg+xml" };
    return {
      ok: false,
      error: "SVG logo contains unsupported or unsafe elements (scripts, external links, or XML entities).",
    };
  }

  return { ok: false, error: "Logo file content is not a valid PNG, JPEG, WebP, GIF, or safe SVG image." };
}

function findZipEndOfCentralDirectory(buf: Buffer): number {
  const minOffset = Math.max(0, buf.length - 65_557);
  for (let offset = buf.length - 22; offset >= minOffset; offset--) {
    if (buf[offset] === 0x50 && buf[offset + 1] === 0x4b && buf[offset + 2] === 0x05 && buf[offset + 3] === 0x06) {
      return offset;
    }
  }
  return -1;
}

/**
 * Inspects an uploaded workbook/CSV buffer before ExcelJS parses it:
 * - Blocks ZIP decompression bombs, excessive entry counts, ZIP64 oversized payloads, path traversal, and non-XLSX ZIPs.
 * - Blocks binary non-ZIP formats (e.g. legacy .xls, executables) and runaway CSV line counts.
 */
export function inspectWorkbookArchive(
  buf: Buffer,
): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (!buf.length) return { ok: false, error: "Uploaded file is empty." };

  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
    if (buf.length < 22 || buf[2] !== 0x03 || buf[3] !== 0x04) {
      return { ok: false, error: "Could not read that file as an Excel workbook." };
    }
    const eocdOffset = findZipEndOfCentralDirectory(buf);
    if (eocdOffset < 0) {
      return { ok: false, error: "Could not read that file as an Excel workbook." };
    }

    const totalEntries = buf.readUInt16LE(eocdOffset + 10);
    const centralDirSize = buf.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);

    if (totalEntries === 0 || totalEntries > MAX_XLSX_ENTRIES) {
      return { ok: false, error: "Workbook contains too many internal sheets or objects." };
    }
    if (centralDirOffset === 0xffffffff || centralDirSize === 0xffffffff || centralDirOffset + centralDirSize > eocdOffset) {
      return { ok: false, error: "Could not read that file as an Excel workbook." };
    }

    let cursor = centralDirOffset;
    let totalUncompressed = 0;
    let sawContentTypes = false;
    let sawWorkbookXml = false;

    for (let i = 0; i < totalEntries; i++) {
      if (
        cursor + 46 > eocdOffset ||
        buf[cursor] !== 0x50 ||
        buf[cursor + 1] !== 0x4b ||
        buf[cursor + 2] !== 0x01 ||
        buf[cursor + 3] !== 0x02
      ) {
        return { ok: false, error: "Could not read that file as an Excel workbook." };
      }

      const compressedSize = buf.readUInt32LE(cursor + 20);
      const uncompressedSize = buf.readUInt32LE(cursor + 24);
      const nameLength = buf.readUInt16LE(cursor + 28);
      const extraLength = buf.readUInt16LE(cursor + 30);
      const commentLength = buf.readUInt16LE(cursor + 32);

      if (cursor + 46 + nameLength + extraLength + commentLength > eocdOffset) {
        return { ok: false, error: "Could not read that file as an Excel workbook." };
      }
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
        return { ok: false, error: "Workbook uncompressed content exceeds the safety limit." };
      }
      if (uncompressedSize > MAX_XLSX_SINGLE_ENTRY_BYTES) {
        return { ok: false, error: "Workbook sheet exceeds the maximum allowed size." };
      }
      if (uncompressedSize > 1_048_576 && compressedSize > 0 && uncompressedSize / compressedSize > 100) {
        return { ok: false, error: "Workbook compression ratio exceeds safety limits." };
      }

      totalUncompressed += uncompressedSize;
      if (totalUncompressed > MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES) {
        return { ok: false, error: "Workbook uncompressed content exceeds the safety limit." };
      }

      const entryName = buf.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
      if (entryName.includes("\u0000") || entryName.includes("\\") || entryName.startsWith("/") || entryName.split("/").includes("..")) {
        return { ok: false, error: "Workbook archive contains invalid file paths." };
      }
      if (entryName === "[Content_Types].xml") sawContentTypes = true;
      if (entryName.startsWith("xl/")) sawWorkbookXml = true;

      cursor += 46 + nameLength + extraLength + commentLength;
    }

    if (!sawContentTypes || !sawWorkbookXml) {
      return { ok: false, error: "Could not read that file as an Excel workbook." };
    }
    return {
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  if (buf.includes(0)) {
    return { ok: false, error: "Could not read that file. Save it as .xlsx or .csv and try again." };
  }

  let newlineCount = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) {
      newlineCount++;
      if (newlineCount > MAX_CSV_LINES) {
        return { ok: false, error: `CSV file exceeds the maximum of ${MAX_CSV_LINES.toLocaleString()} lines.` };
      }
    }
  }
  return { ok: true, mimeType: "text/csv" };
}
