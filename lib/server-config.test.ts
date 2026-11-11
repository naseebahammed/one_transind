import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import test from "node:test";
import {
  adminEmails,
  authSigningSecret,
  cogsFromYear,
  configuredAuthHost,
  databaseConfig,
  entraIssuer,
  hasAdminPasswordLogin,
  isDevLoginEnabled,
  openAiConfig,
  receiptsFromYear,
  salesPeriod,
  salesTable,
  trustProxy,
  verifyAdminPassword,
} from "./server-config.ts";

test("databaseConfig parses port and SSL flag safely", () => {
  const defaults = databaseConfig({ PGHOST: "db.internal", PGDATABASE: "app", PGUSER: "reader", PGPASSWORD: "secret" });
  assert.deepEqual(defaults, {
    host: "db.internal",
    port: 5432,
    database: "app",
    user: "reader",
    password: "secret",
    ssl: false,
  });

  const tls = databaseConfig({ PGPORT: "5433", PGSSL: "true" });
  assert.equal(tls.port, 5433);
  assert.deepEqual(tls.ssl, { rejectUnauthorized: false });
});

test("openAiConfig trims values, treats blank keys as unset, and defaults model", () => {
  assert.deepEqual(openAiConfig({}), { apiKey: undefined, model: "gpt-4o-mini" });
  assert.deepEqual(openAiConfig({ OPENAI_API_KEY: "   ", OPENAI_MODEL: " " }), { apiKey: undefined, model: "gpt-4o-mini" });
  assert.deepEqual(openAiConfig({ OPENAI_API_KEY: " test-key ", OPENAI_MODEL: " gpt-4.1-mini " }), {
    apiKey: "test-key",
    model: "gpt-4.1-mini",
  });
});

test("admin login helpers validate scrypt hash without exposing raw hash", () => {
  const salt = "0123456789abcdef0123456789abcdef";
  const hash = `${salt}:${scryptSync("correct-horse-battery", salt, 32).toString("hex")}`;
  assert.equal(hasAdminPasswordLogin({}), false);
  assert.equal(hasAdminPasswordLogin({ ADMIN_LOGIN_HASH: "  " }), false);
  assert.equal(hasAdminPasswordLogin({ ADMIN_LOGIN_HASH: hash }), true);
  assert.equal(verifyAdminPassword("correct-horse-battery", { ADMIN_LOGIN_HASH: hash }), true);
  assert.equal(verifyAdminPassword("wrong-password", { ADMIN_LOGIN_HASH: hash }), false);
});

test("adminEmails, entraIssuer, and isDevLoginEnabled normalize server env values", () => {
  assert.deepEqual(adminEmails({ ADMIN_EMAILS: " Boss@Transind.com , , Second@Transind.com " }), [
    "boss@transind.com",
    "second@transind.com",
  ]);
  assert.equal(entraIssuer({ AUTH_MICROSOFT_ENTRA_ID_ISSUER: " https://login.microsoftonline.com/t1/v2.0 " }), "https://login.microsoftonline.com/t1/v2.0");
  assert.equal(entraIssuer({ AUTH_MICROSOFT_ENTRA_ID_ISSUER: "  " }), undefined);
  assert.equal(isDevLoginEnabled({ NODE_ENV: "production", AUTH_DEV_LOGIN: "true" }), false);
  assert.equal(isDevLoginEnabled({ NODE_ENV: "development", AUTH_DEV_LOGIN: "true" }), true);
});

test("authSigningSecret, configuredAuthHost, and trustProxy enforce safe defaults", () => {
  assert.equal(authSigningSecret({ AUTH_SECRET: "  explicit-secret  " }), "explicit-secret");
  assert.equal(authSigningSecret({ NEXTAUTH_SECRET: "legacy-secret" }), "legacy-secret");
  const generatedFirst = authSigningSecret({});
  const generatedSecond = authSigningSecret({});
  assert.equal(generatedFirst.length, 64);
  assert.equal(generatedFirst, generatedSecond);

  assert.equal(configuredAuthHost({ AUTH_URL: "https://Portal.OneTransind.com:8443/api/auth" }), "portal.onetransind.com:8443");
  assert.equal(configuredAuthHost({ AUTH_URL: "not-a-url" }), undefined);
  assert.equal(configuredAuthHost({}), undefined);

  assert.equal(trustProxy({}), false);
  assert.equal(trustProxy({ TRUST_PROXY: "false" }), false);
  assert.equal(trustProxy({ TRUST_PROXY: "true" }), true);

  assert.equal(salesTable({ SALES_TABLE: " app.sales_clean " }), "app.sales_clean");
  assert.throws(() => salesTable({ SALES_TABLE: "app.sales_clean; DROP TABLE app.users" }), /SALES_TABLE/);
  assert.equal(salesPeriod({ SALES_PERIOD: " 2026-08 " }), "2026-08");
  assert.equal(salesPeriod({ SALES_PERIOD: "  " }), undefined);

  assert.equal(receiptsFromYear({}), 2026);
  assert.equal(receiptsFromYear({ RECEIPTS_FROM_YEAR: "2025" }), 2025);
  assert.equal(receiptsFromYear({ RECEIPTS_FROM_YEAR: "bad" }), 2026);
  assert.equal(cogsFromYear({}), 2024);
  assert.equal(cogsFromYear({ COGS_FROM_YEAR: "2023" }), 2023);
});

