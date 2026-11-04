import test from "node:test";
import assert from "node:assert/strict";
import { parseCompany } from "./company-input.ts";

const form = (o: Record<string, string>) => Object.entries(o).reduce((f, [k, v]) => (f.set(k, v), f), new FormData());
const sectors = ["log", "fm"];
const propertyTypes = ["apartments", "villa"];
const parse = (f: FormData) => parseCompany(f, sectors, propertyTypes);

test("accepts a valid company and trims the name", () => {
  assert.deepEqual(parse(form({ name: "  Acme ", sector: "log", active: "on" })), { data: { name: "Acme", sector: "log", email: "", phone: "", active: 1, totalRooms: 0, roomTypes: [], propertyType: "", legalName: "", ownershipPct: null, started: "", erpCode: "", dataOwner: "" } });
});

test("parses profile fields", () => {
  const ok = parse(form({ name: "A", sector: "log", legalName: " A WLL ", ownershipPct: "75.5", started: "2024-03-01", erpCode: "501", dataOwner: "Finance" }));
  assert.deepEqual("data" in ok && [ok.data.legalName, ok.data.ownershipPct, ok.data.started, ok.data.erpCode, ok.data.dataOwner], ["A WLL", 75.5, "2024-03-01", "501", "Finance"]);
});

test("rejects bad ownership and start date", () => {
  assert.ok("error" in parse(form({ name: "A", sector: "log", ownershipPct: "101" })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", ownershipPct: "-1" })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", started: "2024-13-40" })));
});

test("rejects bad input", () => {
  assert.ok("error" in parse(form({ name: " ", sector: "log" })));
  assert.ok("error" in parse(form({ name: "A", sector: "nope" })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", email: "not-an-email" })));
});

test("defaults to no room types and accepts a valid list", () => {
  const empty = parse(form({ name: "A", sector: "log" }));
  assert.deepEqual("data" in empty && empty.data.roomTypes, []);
  const roomTypes = [{ type: "1BHK", rooms: 4, standardPrice: 3500 }];
  const ok = parse(form({ name: "A", sector: "log", roomTypes: JSON.stringify(roomTypes) }));
  assert.deepEqual("data" in ok && ok.data.roomTypes, roomTypes);
});

test("rejects malformed room types", () => {
  assert.ok("error" in parse(form({ name: "A", sector: "log", roomTypes: "not json" })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", roomTypes: JSON.stringify([{ type: "", rooms: 1, standardPrice: 1 }]) })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", roomTypes: JSON.stringify([{ type: "1BHK", rooms: -1, standardPrice: 1 }]) })));
});

test("parses total rooms and rejects invalid values", () => {
  const ok = parse(form({ name: "A", sector: "log", totalRooms: "12" }));
  assert.deepEqual("data" in ok && ok.data.totalRooms, 12);
  assert.ok("error" in parse(form({ name: "A", sector: "log", totalRooms: "-1" })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", totalRooms: "1.5" })));
});

test("defaults property type to empty and rejects anything outside the configured list", () => {
  const empty = parse(form({ name: "A", sector: "log" }));
  assert.deepEqual("data" in empty && empty.data.propertyType, "");
  const ok = parse(form({ name: "A", sector: "log", propertyType: "villa" }));
  assert.deepEqual("data" in ok && ok.data.propertyType, "villa");
  assert.ok("error" in parse(form({ name: "A", sector: "log", propertyType: "studio" })));
});
