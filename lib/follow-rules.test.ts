import assert from "node:assert/strict";
import test from "node:test";
import {
  CURSOR_FRESH_MILLISECONDS,
  PRESENCE_REFRESH_MILLISECONDS,
  cleanPath,
  cursorOf,
  pageArea,
  pageBlocked,
  presenceNeedsWrite,
  reportCursor,
  setWatching,
  watchedCursor,
} from "./follow-rules.ts";

test("cleanPath accepts app pages with filters and refuses everything else", () => {
  assert.equal(cleanPath("/sales?month=3&company=7"), "/sales?month=3&company=7");
  assert.equal(cleanPath("/"), "/");
  for (const bad of ["//evil.com", "https://evil.com", "sales", "/api/ask", "/signin", "/no-access", "/admin", "/admin/users", "/admin?x=1", "/a\\b", "/" + "a".repeat(500), 5, null]) {
    assert.equal(cleanPath(bad), null, String(bad));
  }
  assert.equal(cleanPath("/administration"), "/administration"); // only the exact admin area is blocked
});

test("pageArea and pageBlocked follow the module rules", () => {
  assert.equal(pageArea("/sales?month=3"), "sales");
  assert.equal(pageArea("/real-estate/details"), "real-estate");
  assert.equal(pageArea("/"), "");
  assert.equal(pageBlocked("/finance/pnl", ["sales"]), true);
  assert.equal(pageBlocked("/sales?month=3", ["sales"]), false);
  assert.equal(pageBlocked("/finance", null), false); // null = every module
  assert.equal(pageBlocked("/", []), false);
});

test("cursor positions must be fractions of the window and go stale after a few seconds", () => {
  reportCursor("a@x.com", { x: 0.5, y: 0.25 }, 1000);
  assert.deepEqual(cursorOf("a@x.com", 1000 + CURSOR_FRESH_MILLISECONDS - 1), { x: 0.5, y: 0.25 });
  assert.equal(cursorOf("a@x.com", 1000 + CURSOR_FRESH_MILLISECONDS), null);
  reportCursor("b@x.com", { x: 2, y: 0.1 }, 1000);
  reportCursor("c@x.com", { x: "0.5", y: 0.1 }, 1000);
  reportCursor("d@x.com", null, 1000);
  for (const who of ["b@x.com", "c@x.com", "d@x.com"]) assert.equal(cursorOf(who, 1000), null, who);
});

test("a follower only gets the cursor of the person they follow", () => {
  reportCursor("leader@x.com", { x: 0.1, y: 0.2 });
  setWatching("fan@x.com", "leader@x.com");
  assert.deepEqual(watchedCursor("fan@x.com"), { x: 0.1, y: 0.2 });
  setWatching("fan@x.com", null);
  assert.equal(watchedCursor("fan@x.com"), null);
  assert.equal(watchedCursor("stranger@x.com"), null);
});

test("presence is written on a page change, or once the refresh time has passed", () => {
  assert.equal(presenceNeedsWrite("p@x.com", "/sales", 0), true);
  assert.equal(presenceNeedsWrite("p@x.com", "/sales", PRESENCE_REFRESH_MILLISECONDS - 1), false);
  assert.equal(presenceNeedsWrite("p@x.com", "/finance", 100), true);
  assert.equal(presenceNeedsWrite("p@x.com", "/finance", 100 + PRESENCE_REFRESH_MILLISECONDS), true);
});
