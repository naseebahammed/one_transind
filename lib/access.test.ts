import assert from "node:assert/strict";
import test from "node:test";
import { inTenant, normalizeEmail, parseAdminEmails, roleOf } from "./access.ts";

test("parseAdminEmails trims, lowercases and drops empties", () => {
  assert.deepEqual(parseAdminEmails(" A@x.com, b@X.com ,,"), ["a@x.com", "b@x.com"]);
  assert.deepEqual(parseAdminEmails(undefined), []);
  assert.deepEqual(parseAdminEmails(""), []);
});

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail(" Aisha@Transind.com "), "aisha@transind.com");
});

test("roleOf gives admin to env admins whatever the case or spaces", () => {
  assert.equal(roleOf(" A@X.com ", ["a@x.com"], new Set()), "admin");
});

test("roleOf gives user to listed people and null to everyone else", () => {
  assert.equal(roleOf("c@x.com", ["a@x.com"], new Set(["c@x.com"])), "user");
  assert.equal(roleOf("D@x.com", [], new Set(["c@x.com"])), null);
});

test("roleOf with no admins configured makes nobody admin", () => {
  assert.equal(roleOf("a@x.com", [], new Set()), null);
});

test("inTenant is true only when the issuer contains the token's tenant id", () => {
  const issuer = "https://login.microsoftonline.com/abc/v2.0";
  assert.equal(inTenant("abc", issuer), true);
  assert.equal(inTenant("xyz", issuer), false);
  assert.equal(inTenant(undefined, issuer), false);
  assert.equal(inTenant("abc", undefined), false);
});
