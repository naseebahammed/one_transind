// Reads the "BANK POSITION" sheet of the Bank Position workbook: per bank, per account, one row per facility (overdraft, LTR, term loan, guarantees...). Amounts in QAR.
// Pure (no database) so `node --test` can load it. The sheet's own TOTAL rows and bank roll-up blocks are ignored: they are sums of the rows read here, so keeping them would double-count.
// Sign is kept as the sheet gives it: money owed to the bank (overdraft, loans, guarantees issued) is negative, cash held is positive.
import { roundMoney } from "./money.ts";

export type BankPositionRow = {
  bank: string;
  account: string;
  facility: string;
  creditLimit: number | null;
  rate: number | null;
  used: number;
  available: number | null;
};

const text = (c: unknown) => String(c ?? "").replace(/\s+/g, " ").trim();
const isNumber = (c: unknown): c is number => typeof c === "number" && Number.isFinite(c);

// Heading text -> bank name. The first match wins, so "Oman Arab Bank" is listed before "Arab Bank".
const BANKS: [RegExp, string][] = [
  [/^oman arab bank/i, "Oman Arab Bank"], [/^(doha bank)/i, "Doha Bank"], [/^(qatar national bank|qnb)\b/i, "QNB"], [/^arab bank/i, "Arab Bank"],
  [/^(commercial bank in qatar|cbq)\b/i, "CBQ"], [/^mashreq/i, "Mashreq"], [/^hsbc/i, "HSBC"], [/^other account/i, "Other"],
];
const bankOf = (heading: string) => BANKS.find(([pattern]) => pattern.test(heading))?.[1] ?? null;

/** The report date: Excel stores it as a serial number (days since 1899-12-30) or the reader hands back a Date. */
function dateOf(cell: unknown): string | null {
  if (cell instanceof Date) return isNaN(+cell) ? null : cell.toISOString().slice(0, 10);
  if (isNumber(cell) && cell > 40000 && cell < 80000) return new Date(Math.round((cell - 25569) * 86400000)).toISOString().slice(0, 10);
  return null;
}

/** A sheet qualifies when a row near the top starts with "BANK POSITION AS OF" and carries a real date cell (the old 2015 sheet has the date only as text). */
export function bankPositionDate(grid: unknown[][]): string | null {
  for (const row of grid.slice(0, 6)) {
    if (!/^bank position as of/i.test(text(row[0]))) continue;
    const found = row.map(dateOf).find((d) => d);
    if (found) return found;
  }
  return null;
}

/** Of several sheets, the one holding the latest dated bank position. */
export function pickBankPositionSheet<T extends { grid: unknown[][] }>(sheets: T[]): { sheet: T; asOf: string } | null {
  const dated = sheets.flatMap((sheet) => { const asOf = bankPositionDate(sheet.grid); return asOf ? [{ sheet, asOf }] : []; });
  return dated.sort((a, b) => b.asOf.localeCompare(a.asOf))[0] ?? null;
}

export function parseBankPosition(grid: unknown[][]): { asOf: string | null; rows: BankPositionRow[]; errors: string[] } {
  const asOf = bankPositionDate(grid);
  if (!asOf) return { asOf, rows: [], errors: ["No 'BANK POSITION AS OF' row with a date was found. Upload the sheet that holds the current bank position."] };

  const rows: BankPositionRow[] = [], errors: string[] = [], seenBlocks = new Set<string>();
  let bank = "", title = "", inBlock = false, skipBlock = false, block: BankPositionRow[] = [], account = "";

  const closeBlock = () => {
    // The same account pasted twice (Champion Cleaners appears in two places) is read once; a different account with equal figures is not a copy.
    const signature = `${bank}|${account.match(/\d{4,}/)?.[0] ?? title}|${block.map((r) => r.facility + r.used).join(",")}`;
    if (!skipBlock && block.length && !seenBlocks.has(signature)) { seenBlocks.add(signature); rows.push(...block); }
    inBlock = false; block = [];
  };

  grid.forEach((row, index) => {
    const first = text(row[0]);
    const rest = row.slice(1, 5);
    const textOnly = first !== "" && rest.every((c) => c === null || c === undefined || text(c) === "");
    if (/^facility$/i.test(first)) {
      if (inBlock) closeBlock();
      inBlock = true; account = title;
      // Roll-up blocks ("DOHA BANK TOTAL", the group block with no title) are sums of the account blocks.
      skipBlock = !title || /total/i.test(title);
      return;
    }
    if (textOnly && (!inBlock || !/^total\b/i.test(first))) {
      const named = bankOf(first);
      if (named) bank = named;
      if (!inBlock) title = first;
      else if (/\d{4,}/.test(first)) account = first; // a second account listed inside one block (CBQ Top Clean)
      return;
    }
    if (!inBlock || first === "") return;
    if (/^total\b/i.test(first) && first.includes("=")) { closeBlock(); title = ""; return; }
    if (/total|^other account/i.test(first)) return; // summary lines the sheet puts under the "OTHER ACCOUNT" list

    const [limitCell, rateCell, usedCell, availableCell] = [row[1], row[2], row[3], row[4]];
    const used = usedCell === null || usedCell === undefined || text(usedCell) === "" ? 0 : isNumber(usedCell) ? usedCell : NaN;
    if (Number.isNaN(used)) { errors.push(`Row ${index + 1} (${first}): "${text(usedCell)}" is not a number.`); return; }
    const creditLimit = isNumber(limitCell) ? limitCell : null; // text such as "11.500M" only appears in the summary blocks that are skipped
    const available = isNumber(availableCell) ? availableCell : null;
    // The sheet has one rate cell holding 409909.032 on a current account (a typing slip); a rate is a fraction, so anything above 1 is not kept.
    const rate = isNumber(rateCell) && rateCell >= 0 && rateCell <= 1 ? rateCell : null;
    if (!bank) { errors.push(`Row ${index + 1} (${first}): no bank heading above it.`); return; }
    if (used === 0 && !creditLimit && !available) return; // facility with nothing on it
    block.push({ bank, account: account || "—", facility: first, creditLimit: creditLimit === null ? null : roundMoney(creditLimit), rate, used: roundMoney(used), available: available === null ? null : roundMoney(available) });
  });
  if (inBlock) closeBlock();
  if (!rows.length && !errors.length) errors.push("No facility rows were found in the bank position sheet.");
  return { asOf, rows, errors };
}

export type BankPositionKind = "cash" | "borrowing" | "guarantee";

/** Guarantees and letters of credit are commitments, not drawn cash; other negative rows are borrowing (overdraft, LTR, DCF, loans); positive rows are cash held. */
export function bankPositionKind(row: Pick<BankPositionRow, "facility" | "used">): BankPositionKind {
  if (/\bl\/?[gc]\b|tender|performance|\bbond\b/i.test(row.facility)) return "guarantee";
  return row.used > 0 ? "cash" : "borrowing";
}
