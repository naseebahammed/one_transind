import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanMultilineText,
  cleanText,
  escapeLikePattern,
  isValidFigureAmount,
  MAX_FIGURE_AMOUNT,
  MAX_PG_INT,
  parseNonNegativeInt,
  parsePositiveIntId,
  parseSlugKey,
  validateSqlTableIdentifier,
} from "./input-validation.ts";

test("parsePositiveIntId accepts 1..MAX_PG_INT and rejects overflow, zero, negatives, floats, and junk", () => {
  assert.equal(parsePositiveIntId(1), 1);
  assert.equal(parsePositiveIntId("42"), 42);
  assert.equal(parsePositiveIntId(String(MAX_PG_INT)), MAX_PG_INT);

  assert.equal(parsePositiveIntId(0), null);
  assert.equal(parsePositiveIntId(-5), null);
  assert.equal(parsePositiveIntId(3.14), null);
  assert.equal(parsePositiveIntId(MAX_PG_INT + 1), null);
  assert.equal(parsePositiveIntId("9999999999"), null);
  assert.equal(parsePositiveIntId("12abc"), null);
  assert.equal(parsePositiveIntId(null), null);
  assert.equal(parsePositiveIntId(undefined), null);
  assert.equal(parsePositiveIntId(true), null);
});

test("parseNonNegativeInt enforces upper bounds and optional empty-to-zero behavior", () => {
  assert.equal(parseNonNegativeInt("", 100_000, true), 0);
  assert.equal(parseNonNegativeInt(null, 100_000, true), 0);
  assert.equal(parseNonNegativeInt("", 100_000, false), null);
  assert.equal(parseNonNegativeInt("0", 100_000), 0);
  assert.equal(parseNonNegativeInt("250", 100_000), 250);
  assert.equal(parseNonNegativeInt("100001", 100_000), null);
  assert.equal(parseNonNegativeInt("-1", 100_000), null);
});

test("isValidFigureAmount rejects NaN, Infinity, non-numbers, and NUMERIC(18,2) overflow", () => {
  assert.equal(isValidFigureAmount(0), true);
  assert.equal(isValidFigureAmount(-125_430.55), true);
  assert.equal(isValidFigureAmount("100"), false);
  assert.equal(isValidFigureAmount(Number.NaN), false);
  assert.equal(isValidFigureAmount(Number.POSITIVE_INFINITY), false);
  assert.equal(isValidFigureAmount(MAX_FIGURE_AMOUNT), false);
  assert.equal(isValidFigureAmount(-1e30), false);
});

test("cleanText and cleanMultilineText strip null bytes and control characters and never turn null into 'null'", () => {
  assert.equal(cleanText(null, 50), "");
  assert.equal(cleanText(undefined, 50), "");
  assert.equal(cleanText({ bad: true }, 50), "");
  assert.equal(cleanText("  Al\u0000  Manzil\t\nTower  ", 50), "Al Manzil Tower");
  assert.equal(cleanText("abcdef", 4), "abcd");

  assert.equal(cleanMultilineText("Line 1\r\nLine\u0000 2\u0007", 100), "Line 1\nLine 2");
  assert.equal(cleanMultilineText(null, 100), "");
});

test("parseSlugKey accepts valid lowercase slugs and rejects 'null' or unsafe keys", () => {
  assert.equal(parseSlugKey("re"), "re");
  assert.equal(parseSlugKey("health-beauty-2"), "health-beauty-2");
  assert.equal(parseSlugKey(null), null);
  assert.equal(parseSlugKey(""), null);
  assert.equal(parseSlugKey("-bad"), null);
  assert.equal(parseSlugKey("UPPER"), null);
  assert.equal(parseSlugKey("a/b"), null);
});

test("escapeLikePattern neutralizes SQL LIKE wildcards and trailing backslashes", () => {
  assert.equal(escapeLikePattern("100% real_estate\\"), "100\\% real\\_estate\\\\");
});

test("validateSqlTableIdentifier accepts schema.table and rejects SQL injection payloads", () => {
  assert.equal(validateSqlTableIdentifier("app.sales_clean"), "app.sales_clean");
  assert.equal(validateSqlTableIdentifier(" public.invs_daily_sales_v "), "public.invs_daily_sales_v");
  assert.equal(validateSqlTableIdentifier("sales_view"), "sales_view");

  assert.throws(() => validateSqlTableIdentifier(""), /SALES_TABLE/);
  assert.throws(() => validateSqlTableIdentifier(undefined), /SALES_TABLE/);
  assert.throws(() => validateSqlTableIdentifier("app.sales_clean; DROP TABLE app.users--"), /SALES_TABLE/);
  assert.throws(() => validateSqlTableIdentifier("app.sales_clean s WHERE 1=1"), /SALES_TABLE/);
  assert.throws(() => validateSqlTableIdentifier("(SELECT * FROM pg_shadow)"), /SALES_TABLE/);
});
