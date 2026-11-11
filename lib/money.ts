// Exact 2-decimal QAR rounding, string parsing, and minor-unit summation.
// Pure (no imports) so `node --test` can load any module that depends on it.

const UNSIGNED_NUMBER_RE = /^(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;

const ZERO_MINOR = BigInt(0);
const ONE_MINOR = BigInt(1);
const HUNDRED_MINOR = BigInt(100);
const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function roundUnsignedDecimal(raw: string, negative: boolean): number | null {
  if (!raw || raw.length > 40) return null;
  const match = raw.match(UNSIGNED_NUMBER_RE);
  if (!match) return null;
  const intPart = match[1] ?? "";
  const fracPart = match[2] ?? match[3] ?? "";
  const exponent = match[4] ? Number(match[4]) : 0;
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 30) return null;

  const digits = intPart + fracPart;
  const scale = fracPart.length - exponent;
  let intDigits: string;
  let fracDigits: string;
  if (scale <= 0) {
    intDigits = digits + "0".repeat(-scale);
    fracDigits = "";
  } else if (scale >= digits.length) {
    intDigits = "0";
    fracDigits = "0".repeat(scale - digits.length) + digits;
  } else {
    intDigits = digits.slice(0, digits.length - scale);
    fracDigits = digits.slice(digits.length - scale);
  }

  const paddedFrac = `${fracDigits}000`;
  const firstTwo = paddedFrac.slice(0, 2);
  const thirdDigit = paddedFrac.charCodeAt(2) - 48;
  let minorUnits = BigInt(intDigits || "0") * HUNDRED_MINOR + BigInt(firstTwo);
  if (thirdDigit >= 5) minorUnits += ONE_MINOR;
  if (minorUnits === ZERO_MINOR) return 0;
  if (minorUnits > MAX_SAFE_MINOR) return null;
  const signedMinor = negative ? -Number(minorUnits) : Number(minorUnits);
  return signedMinor / 100;
}

/** Rounds a finite number to 2 decimal places (half away from zero), stripping IEEE-754 binary float drift such as 1.005 -> 1.01 and 0.1 + 0.2 -> 0.3. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? 0 : value;
  const abs = Math.abs(value);
  const text = abs < 1e12 ? abs.toPrecision(15) : abs.toFixed(4);
  return roundUnsignedDecimal(text, value < 0) ?? Math.round(value * 100) / 100;
}

/** Parses formatted numeric text (commas, leading sign, or accounting parentheses like "(1,234.505)") directly to a 2-decimal rounded QAR number, or returns null when invalid. */
export function parseMoneyString(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parenNegative = /^\(.*\)$/.test(trimmed);
  const body = (parenNegative ? trimmed.slice(1, -1) : trimmed).replaceAll(",", "").trim();
  if (!body) return null;
  if (parenNegative && /^[+-]/.test(body)) return null;
  const negative = parenNegative || body.startsWith("-");
  const unsigned = /^[+-]/.test(body) ? body.slice(1) : body;
  return roundUnsignedDecimal(unsigned, negative);
}

/** Adds an array of QAR figures in integer dirhams (minor units) so repeated additions never accumulate floating-point noise. */
export function sumMoney(values: readonly number[]): number {
  let minorTotal = 0;
  for (const value of values) {
    if (!value) continue;
    minorTotal += Math.round(roundMoney(value) * 100);
  }
  return minorTotal === 0 ? 0 : minorTotal / 100;
}
