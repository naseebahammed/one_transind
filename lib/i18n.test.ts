import test from "node:test";
import assert from "node:assert/strict";
import { translator } from "./i18n.ts";

test("Arabic translates known text and leaves the rest English", () => {
  const translate = translator("ar");
  assert.equal(translate("Year to date"), "منذ بداية العام");
  assert.equal(translate("Some label nobody translated"), "Some label nobody translated");
});

test("English returns the text unchanged", () => {
  assert.equal(translator("en")("Year to date"), "Year to date");
});
