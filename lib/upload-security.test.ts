import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { inspectLogoUpload, inspectWorkbookArchive, sanitizeUploadFileName } from "./upload-security.ts";

function buildMinimalZip(entries: { name: string; compressedSize: number; uncompressedSize: number; data?: Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const payload = entry.data ?? Buffer.alloc(Math.min(entry.compressedSize, 16), 0x41);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(entry.compressedSize, 18);
    localHeader.writeUInt32LE(entry.uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(entry.compressedSize, 20);
    centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);

    localParts.push(localHeader, nameBuf, payload);
    centralParts.push(centralHeader, nameBuf);
    localOffset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

test("sanitizeUploadFileName strips paths, leading dots, and control characters", () => {
  assert.equal(sanitizeUploadFileName("C:\\fakepath\\..\\../Report\u0000_Jan.xlsx"), "Report_Jan.xlsx");
  assert.equal(sanitizeUploadFileName("../../.env"), "env");
  assert.equal(sanitizeUploadFileName(""), "upload");
  assert.equal(sanitizeUploadFileName(null), "upload");
});

test("inspectLogoUpload detects real image signatures and blocks spoofed MIME files and unsafe SVGs", () => {
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.deepEqual(inspectLogoUpload(validPng), { ok: true, mimeType: "image/png" });

  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.deepEqual(inspectLogoUpload(validJpeg), { ok: true, mimeType: "image/jpeg" });

  const validWebp = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBP", "ascii")]);
  assert.deepEqual(inspectLogoUpload(validWebp), { ok: true, mimeType: "image/webp" });

  const cleanSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
  assert.deepEqual(inspectLogoUpload(cleanSvg), { ok: true, mimeType: "image/svg+xml" });

  // Spoofed HTML claiming to be PNG
  const spoofedHtml = Buffer.from("<!DOCTYPE html><html><script>alert(1)</script></html>");
  assert.equal(inspectLogoUpload(spoofedHtml).ok, false);

  // Malicious SVG payloads: script tag, event handler, XXE DOCTYPE/ENTITY, foreignObject, external beacon
  for (const payload of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body>x</body></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/pixel.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)">x</a></svg>',
  ]) {
    const res = inspectLogoUpload(Buffer.from(payload, "utf8"));
    assert.equal(res.ok, false, `Expected malicious SVG to be blocked: ${payload}`);
  }
});

test("inspectWorkbookArchive accepts real ExcelJS workbooks and CSVs, and blocks ZIP bombs, non-XLSX ZIPs, and path traversal", async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Data").addRow(["Jan", 100]);
  const realXlsx = Buffer.from(await wb.xlsx.writeBuffer());
  assert.deepEqual(inspectWorkbookArchive(realXlsx), {
    ok: true,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  assert.deepEqual(inspectWorkbookArchive(Buffer.from("Date,Sales\n2026-01-01,500\n", "utf8")), {
    ok: true,
    mimeType: "text/csv",
  });

  // Decompression bomb: 16 bytes compressed claiming 20 MB uncompressed (> 100:1 ratio)
  const ratioBomb = buildMinimalZip([
    { name: "[Content_Types].xml", compressedSize: 16, uncompressedSize: 200 },
    { name: "xl/sharedStrings.xml", compressedSize: 16, uncompressedSize: 20 * 1024 * 1024 },
  ]);
  const ratioRes = inspectWorkbookArchive(ratioBomb);
  assert.equal(ratioRes.ok, false);

  // Total uncompressed size bomb (> 50 MB across entries)
  const totalBomb = buildMinimalZip([
    { name: "[Content_Types].xml", compressedSize: 1_000_000, uncompressedSize: 20 * 1024 * 1024 },
    { name: "xl/worksheets/sheet1.xml", compressedSize: 1_000_000, uncompressedSize: 20 * 1024 * 1024 },
    { name: "xl/worksheets/sheet2.xml", compressedSize: 1_000_000, uncompressedSize: 20 * 1024 * 1024 },
  ]);
  assert.equal(inspectWorkbookArchive(totalBomb).ok, false);

  // ZIP-slip traversal inside archive
  const traversalZip = buildMinimalZip([
    { name: "[Content_Types].xml", compressedSize: 16, uncompressedSize: 32 },
    { name: "xl/../../evil.xml", compressedSize: 16, uncompressedSize: 32 },
  ]);
  assert.equal(inspectWorkbookArchive(traversalZip).ok, false);

  // Plain ZIP that is not an XLSX workbook
  const plainZip = buildMinimalZip([{ name: "readme.txt", compressedSize: 10, uncompressedSize: 10 }]);
  assert.equal(inspectWorkbookArchive(plainZip).ok, false);

  // Arbitrary binary file (e.g. PNG/EXE renamed to .csv) rejected by null-byte check
  assert.equal(inspectWorkbookArchive(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])).ok, false);
});
