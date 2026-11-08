import assert from "node:assert/strict";
import test from "node:test";
import { currentRole } from "./current-role.ts";

const listed = async () => new Set(["staff@x.com"]);
const broken = async (): Promise<Set<string>> => { throw new Error("database down"); };

async function withAdmins<T>(value: string | undefined, run: () => Promise<T>) {
  const before = process.env.ADMIN_EMAILS;
  if (value === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = value;
  try { return await run(); } finally { if (before === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = before; }
}

test("currentRole: listed person is a user, env admin is an admin, stranger gets null", () =>
  withAdmins("boss@x.com", async () => {
    assert.equal(await currentRole("Staff@X.com", listed), "user");
    assert.equal(await currentRole("boss@x.com", listed), "admin");
    assert.equal(await currentRole("who@x.com", listed), null);
  }));

test("currentRole: no email means no access", () =>
  withAdmins("boss@x.com", async () => {
    assert.equal(await currentRole(null, listed), null);
    assert.equal(await currentRole(undefined, listed), null);
  }));

test("currentRole: when the list cannot be read, env admins still pass and listed people do not", () =>
  withAdmins("boss@x.com", async () => {
    assert.equal(await currentRole("boss@x.com", broken), "admin");
    assert.equal(await currentRole("staff@x.com", broken), null);
  }));

test("currentRole: unset ADMIN_EMAILS makes nobody admin", () =>
  withAdmins(undefined, async () => {
    assert.equal(await currentRole("boss@x.com", listed), null);
  }));
