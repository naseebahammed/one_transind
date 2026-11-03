import test from "node:test";
import assert from "node:assert/strict";
import { parseDeal } from "./deal-input.ts";

const sectors = ["fmcg", "hb"];
const ok = { sector: "hb", acc: " Acme ", value: 1000.4, owner: 2, close: "2026-03-31" };

test("accepts a valid deal, trims and rounds", () => {
  assert.deepEqual(parseDeal(ok, sectors), { sector: "hb", acc: "Acme", value: 1000, owner: 2, close: "2026-03-31" });
});

test("rejects bad input", () => {
  for (const bad of [
    { ...ok, sector: "nope" },
    { ...ok, acc: " " },
    { ...ok, value: 0 },
    { ...ok, value: 3e9 }, // too big for the INTEGER column
    { ...ok, owner: -1 },
    { ...ok, owner: "1" },
    { ...ok, close: "2026-02-31" },
    { ...ok, close: "2026-99-99" },
  ]) assert.equal(parseDeal(bad, sectors), null, JSON.stringify(bad));
  assert.equal(parseDeal(null, sectors), null);
});
