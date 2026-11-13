import assert from "node:assert/strict";
import { canOpen } from "./access-levels.ts";
import test from "node:test";
import { apiStatus, devLoginEnabled, hashPassword, inTenant, normalizeEmail, parseAdminEmails, passwordMatches, roleOf, userDisplayName, userInitials } from "./access.ts";

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
  assert.equal(inTenant("v2.0", issuer), false);
  assert.equal(inTenant("common", "https://login.microsoftonline.com/common/v2.0"), false);
  assert.equal(inTenant(undefined, issuer), false);
  assert.equal(inTenant("abc", undefined), false);
});

test("apiStatus separates 401 unauthenticated, 403 forbidden and null allowed", () => {
  assert.equal(apiStatus(undefined, null), 401);
  assert.equal(apiStatus("stranger@x.com", null), 403);
  assert.equal(apiStatus("staff@x.com", "user"), null);
  assert.equal(apiStatus("staff@x.com", "user", "admin"), 403);
  assert.equal(apiStatus("boss@x.com", "admin", "admin"), null);
});

test("devLoginEnabled needs the flag AND a non-production build", () => {
  assert.equal(devLoginEnabled({ NODE_ENV: "development", AUTH_DEV_LOGIN: "true" }), true);
  assert.equal(devLoginEnabled({ NODE_ENV: "development" }), false);
  assert.equal(devLoginEnabled({ NODE_ENV: "development", AUTH_DEV_LOGIN: "1" }), false);
  assert.equal(devLoginEnabled({ NODE_ENV: "production", AUTH_DEV_LOGIN: "true" }), false);
  assert.equal(devLoginEnabled({ AUTH_DEV_LOGIN: "true" }), true);
});

test("admin password check", () => {
  const stored = hashPassword("correct horse battery");
  assert.equal(passwordMatches("correct horse battery", stored), true);
  assert.equal(passwordMatches("wrong", stored), false);
  assert.equal(passwordMatches("anything", undefined), false);
  assert.equal(passwordMatches("anything", "garbage"), false);
  assert.equal(passwordMatches("anything", "salt:00"), false);
  assert.equal(passwordMatches("x".repeat(300), stored), false);
});

test("userDisplayName prefers profile name and falls back to email username", () => {
  assert.equal(userDisplayName(" Aisha Al-Thani ", "aisha@transind.com"), "Aisha Al-Thani");
  assert.equal(userDisplayName("  ", "mohammed.ali@transind.com"), "mohammed.ali");
  assert.equal(userDisplayName(undefined, "admin@transind.com"), "admin");
});

test("userInitials extracts up to two uppercase initials", () => {
  assert.equal(userInitials("Aisha Al-Thani", "aisha@transind.com"), "AA");
  assert.equal(userInitials(undefined, "mohammed.ali@transind.com"), "MA");
  assert.equal(userInitials(null, "admin@transind.com"), "A");
});

test("canOpen: full opens everything, finance and operations only their own pages", () => {
  assert.equal(canOpen("full", "hr"), true);
  assert.equal(canOpen("finance", "finance"), true);
  assert.equal(canOpen("finance", "hr"), false);
  assert.equal(canOpen("operations", "logistics"), true);
  assert.equal(canOpen("operations", "finance"), false);
});
