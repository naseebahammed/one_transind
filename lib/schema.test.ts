import assert from "node:assert/strict";
import test from "node:test";
import { LATEST_MIGRATION_ID, migrate } from "./schema.ts";

test("migrate applies 026_performance_indexes with purely additive index statements and skips already-applied migrations", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  const applied = new Set([
    "001_baseline", "002_standard_data", "003_drop_report_files", "005_company_expenses",
    "006_company_branches", "007_company_has_branches", "008_daily_receipts", "009_drop_deals",
    "010_drop_invoices", "011_enterprise_foundation", "012_rejected_rows_loaded", "013_restaurant_cogs",
    "014_drop_ownership_pct", "015_fmcg_masters", "016_data_standardization", "017_fmcg_sales_views",
    "018_fmcg_balances", "019_fmcg_control", "020_app_optimizations", "021_app_users",
    "022_erp_outstanding", "023_sales_clean", "024_employees", "025_company_departments",
  ]);

  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) {
        return { rows: [...applied].map((id) => ({ id })) };
      }
      return { rows: [] };
    },
  });

  const recordStep = executed.find((step) => step.sql.startsWith("INSERT INTO app.schema_migrations"));
  assert.ok(recordStep, "expected 026_performance_indexes to be recorded");
  assert.deepEqual(recordStep.params, ["026_performance_indexes"]);

  const indexStep = executed[executed.indexOf(recordStep) - 1];
  assert.ok(indexStep, "expected SQL step right before recording migration");
  assert.doesNotMatch(indexStep.sql, /\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER)\b/i, "026_performance_indexes must be strictly additive");
  for (const line of indexStep.sql.trim().split("\n")) {
    assert.ok(
      line.startsWith("CREATE INDEX IF NOT EXISTS ") || line.startsWith("DO 'BEGIN IF to_regclass("),
      `Unexpected statement in 026_performance_indexes: ${line}`,
    );
  }
});

test("migrate applies 028_financial_and_date_integrity without deleting or dropping data", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  const applied = new Set([
    "001_baseline", "002_standard_data", "003_drop_report_files", "005_company_expenses",
    "006_company_branches", "007_company_has_branches", "008_daily_receipts", "009_drop_deals",
    "010_drop_invoices", "011_enterprise_foundation", "012_rejected_rows_loaded", "013_restaurant_cogs",
    "014_drop_ownership_pct", "015_fmcg_masters", "016_data_standardization", "017_fmcg_sales_views",
    "018_fmcg_balances", "019_fmcg_control", "020_app_optimizations", "021_app_users",
    "022_erp_outstanding", "023_sales_clean", "024_employees", "025_company_departments",
    "026_performance_indexes", "027_drop_balance_sheet",
  ]);

  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) {
        return { rows: [...applied].map((id) => ({ id })) };
      }
      return { rows: [] };
    },
  });

  const recordStep = executed.find((step) => step.sql.startsWith("INSERT INTO app.schema_migrations"));
  assert.ok(recordStep, "expected 028_financial_and_date_integrity to be recorded");
  assert.deepEqual(recordStep.params, ["028_financial_and_date_integrity"]);

  const migrationStep = executed[executed.indexOf(recordStep) - 1];
  assert.ok(migrationStep, "expected SQL step right before recording migration");
  assert.doesNotMatch(migrationStep.sql, /\b(DROP|DELETE|TRUNCATE)\b/i);
  assert.match(migrationStep.sql, /CREATE OR REPLACE VIEW rpt\.company_monthly_revenue AS/);
  assert.match(migrationStep.sql, /DENSE_RANK\(\) OVER \(PARTITION BY company_id, period ORDER BY priority\)/);
  assert.match(migrationStep.sql, /NOT IN \('bank deposits', 'bank deposit'\)/);
  assert.match(migrationStep.sql, /employees_dates_valid CHECK \(left_on IS NULL OR left_on >= joined\)/);
});

test("migrate applies 030_sales_clean_line_key: one row per sales line, only the sales_clean view is rebuilt, ERP table untouched", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  const applied = new Set([
    "001_baseline", "002_standard_data", "003_drop_report_files", "005_company_expenses",
    "006_company_branches", "007_company_has_branches", "008_daily_receipts", "009_drop_deals",
    "010_drop_invoices", "011_enterprise_foundation", "012_rejected_rows_loaded", "013_restaurant_cogs",
    "014_drop_ownership_pct", "015_fmcg_masters", "016_data_standardization", "017_fmcg_sales_views",
    "018_fmcg_balances", "019_fmcg_control", "020_app_optimizations", "021_app_users",
    "022_erp_outstanding", "023_sales_clean", "024_employees", "025_company_departments",
    "026_performance_indexes", "027_drop_balance_sheet", "028_financial_and_date_integrity", "029_sales_department_targets",
  ]);

  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) return { rows: [...applied].map((id) => ({ id })) };
      return { rows: [] };
    },
  });

  const recordStep = executed.find((step) => step.sql.startsWith("INSERT INTO app.schema_migrations"));
  assert.ok(recordStep, "expected 030_sales_clean_line_key to be recorded");
  assert.deepEqual(recordStep.params, ["030_sales_clean_line_key"]);

  const sql = executed[executed.indexOf(recordStep) - 1].sql;
  // Every statement runs only when the ERP table exists, so a database without it (staging) skips the migration.
  const guarded = sql.match(/^DO 'BEGIN IF to_regclass\(''public\.invs_fdd_fnb_sales_do_t''\) IS NOT NULL THEN EXECUTE ''/gm) ?? [];
  assert.equal(guarded.length, 7); // drop, create, five indexes
  assert.equal((sql.match(/^DO '/gm) ?? []).length, 7);
  assert.match(sql, /DROP MATERIALIZED VIEW IF EXISTS app\.sales_clean/);
  assert.doesNotMatch(sql, /DELETE|TRUNCATE|UPDATE|ALTER|DROP TABLE|CASCADE/i);
  assert.match(sql, /SELECT DISTINCT ON \(s\."DOC_TYPE", s\."DOC_NO", s\."PROV_NO", s\."ITEM_CODE"/);
  assert.match(sql, /ORDER BY s\."DOC_TYPE".*s\."CREATED_DATE" DESC NULLS LAST/);
  assert.match(sql, /s\."NET_AMOUNT_WOT" AS "NET_AMOUNT", s\."NET_COST_WOT" AS "NET_COST"/);
  // The five indexes dropped with the view come back.
  for (const index of ["doc_date", "dept_date", "date_cust", "cust_no", "item_code"]) assert.match(sql, new RegExp(`CREATE INDEX sales_clean_${index} ON app\\.sales_clean`));
});

test("migrate applies 033_sales_clean_all_lines: no de-duplication, only the sales_clean view is rebuilt", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  const applied = new Set([
    "001_baseline", "002_standard_data", "003_drop_report_files", "005_company_expenses",
    "006_company_branches", "007_company_has_branches", "008_daily_receipts", "009_drop_deals",
    "010_drop_invoices", "011_enterprise_foundation", "012_rejected_rows_loaded", "013_restaurant_cogs",
    "014_drop_ownership_pct", "015_fmcg_masters", "016_data_standardization", "017_fmcg_sales_views",
    "018_fmcg_balances", "019_fmcg_control", "020_app_optimizations", "021_app_users",
    "022_erp_outstanding", "023_sales_clean", "024_employees", "025_company_departments",
    "026_performance_indexes", "027_drop_balance_sheet", "028_financial_and_date_integrity", "029_sales_department_targets",
    "030_sales_clean_line_key", "031_manual_report_data", "032_tenancy",
  ]);

  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) return { rows: [...applied].map((id) => ({ id })) };
      return { rows: [] };
    },
  });

  const recordStep = executed.find((step) => step.sql.startsWith("INSERT INTO app.schema_migrations"));
  assert.ok(recordStep, "expected 033_sales_clean_all_lines to be recorded");
  assert.deepEqual(recordStep.params, ["033_sales_clean_all_lines"]);

  const sql = executed[executed.indexOf(recordStep) - 1].sql;
  assert.equal((sql.match(/^DO 'BEGIN IF to_regclass\(''public\.invs_fdd_fnb_sales_do_t''\) IS NOT NULL THEN EXECUTE ''/gm) ?? []).length, 10); // 2 drops, create, 5 indexes, sales_monthly and its index
  assert.match(sql, /DROP MATERIALIZED VIEW IF EXISTS app\.sales_clean/);
  // sales_monthly reads sales_clean: dropped before it, created after it.
  assert.ok(sql.indexOf("DROP MATERIALIZED VIEW IF EXISTS app.sales_monthly") < sql.indexOf("DROP MATERIALIZED VIEW IF EXISTS app.sales_clean"));
  assert.ok(sql.indexOf("CREATE MATERIALIZED VIEW app.sales_clean") < sql.indexOf("CREATE MATERIALIZED VIEW app.sales_monthly"));
  assert.match(sql, /CREATE INDEX sales_monthly_month_idx ON app\.sales_monthly/);
  assert.match(sql, /WHERE "DOC_TYPE" IN \(''''IN-DTS'''',''''IN-OT'''',''''CR''''\)/);
  assert.doesNotMatch(sql, /DISTINCT/);
  assert.doesNotMatch(sql, /DELETE|TRUNCATE|UPDATE|ALTER|DROP TABLE|CASCADE/i);
  for (const index of ["doc_date", "dept_date", "date_cust", "cust_no", "item_code"]) assert.match(sql, new RegExp(`CREATE INDEX sales_clean_${index} ON app\\.sales_clean`));
});

test("migrate applies 031_manual_report_data additively for all manual report tables", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  const applied = new Set([
    "001_baseline", "002_standard_data", "003_drop_report_files", "005_company_expenses",
    "006_company_branches", "007_company_has_branches", "008_daily_receipts", "009_drop_deals",
    "010_drop_invoices", "011_enterprise_foundation", "012_rejected_rows_loaded", "013_restaurant_cogs",
    "014_drop_ownership_pct", "015_fmcg_masters", "016_data_standardization", "017_fmcg_sales_views",
    "018_fmcg_balances", "019_fmcg_control", "020_app_optimizations", "021_app_users",
    "022_erp_outstanding", "023_sales_clean", "024_employees", "025_company_departments",
    "026_performance_indexes", "027_drop_balance_sheet", "028_financial_and_date_integrity",
    "029_sales_department_targets", "030_sales_clean_line_key",
  ]);

  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) return { rows: [...applied].map((id) => ({ id })) };
      return { rows: [] };
    },
  });

  const recordStep = executed.find((step) => step.sql.startsWith("INSERT INTO app.schema_migrations"));
  assert.ok(recordStep, "expected 031_manual_report_data to be recorded");
  assert.deepEqual(recordStep.params, ["031_manual_report_data"]);
  assert.equal(LATEST_MIGRATION_ID, "033_sales_clean_all_lines");

  const sql = executed[executed.indexOf(recordStep) - 1].sql;
  assert.doesNotMatch(sql, /\b(DROP\s|DELETE\s+FROM|TRUNCATE\s|UPDATE\s|ALTER\s)\b/i);
  for (const table of [
    "sales_sector_indicators", "receivables_snapshots", "overdue_invoices", "customer_opportunities",
    "hr_leave_requests", "hr_expiring_documents", "logistics_kpis", "logistics_fleet",
    "logistics_shipments", "logistics_warehouses", "logistics_customs",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS app\\.${table}\\b`));
  }
});
