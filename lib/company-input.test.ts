import test from "node:test";
import assert from "node:assert/strict";
import { parseCompany } from "./company-input.ts";

const form = (o: Record<string, string>) => Object.entries(o).reduce((f, [k, v]) => (f.set(k, v), f), new FormData());
const sectors = ["log", "fm"];

test("accepts a valid company and trims the name", () => {
  assert.deepEqual(parseCompany(form({ name: "  Acme ", sector: "log", active: "on" }), sectors), { data: { name: "Acme", sector: "log", email: "", phone: "", active: 1, totalRooms: 0, roomTypes: [] } });
});

test("rejects bad input", () => {
  assert.ok("error" in parseCompany(form({ name: " ", sector: "log" }), sectors));
  assert.ok("error" in parseCompany(form({ name: "A", sector: "nope" }), sectors));
  assert.ok("error" in parseCompany(form({ name: "A", sector: "log", email: "not-an-email" }), sectors));
});

test("defaults to no room types and accepts a valid list", () => {
  const empty = parseCompany(form({ name: "A", sector: "log" }), sectors);
  assert.deepEqual("data" in empty && empty.data.roomTypes, []);
  const roomTypes = [{ type: "1BHK", rooms: 4, standardPrice: 3500 }];
  const ok = parseCompany(form({ name: "A", sector: "log", roomTypes: JSON.stringify(roomTypes) }), sectors);
  assert.deepEqual("data" in ok && ok.data.roomTypes, roomTypes);
});

test("rejects malformed room types", () => {
  assert.ok("error" in parseCompany(form({ name: "A", sector: "log", roomTypes: "not json" }), sectors));
  assert.ok("error" in parseCompany(form({ name: "A", sector: "log", roomTypes: JSON.stringify([{ type: "", rooms: 1, standardPrice: 1 }]) }), sectors));
  assert.ok("error" in parseCompany(form({ name: "A", sector: "log", roomTypes: JSON.stringify([{ type: "1BHK", rooms: -1, standardPrice: 1 }]) }), sectors));
});

test("parses total rooms and rejects invalid values", () => {
  const ok = parseCompany(form({ name: "A", sector: "log", totalRooms: "12" }), sectors);
  assert.deepEqual("data" in ok && ok.data.totalRooms, 12);
  assert.ok("error" in parseCompany(form({ name: "A", sector: "log", totalRooms: "-1" }), sectors));
  assert.ok("error" in parseCompany(form({ name: "A", sector: "log", totalRooms: "1.5" }), sectors));
});
