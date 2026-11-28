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
  assert.equal(LATEST_MIGRATION_ID, "050_sales_clean_trading_types");

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

test("migrate applies 039_sales_clean_halve_old_copies: only the sales_clean view is rebuilt, older lines keep half of their copies, 2026 onward is untouched", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  const applied = new Set([
    "001_baseline", "002_standard_data", "003_drop_report_files", "005_company_expenses", "006_company_branches", "007_company_has_branches", "008_daily_receipts", "009_drop_deals",
    "010_drop_invoices", "011_enterprise_foundation", "012_rejected_rows_loaded", "013_restaurant_cogs", "014_drop_ownership_pct", "015_fmcg_masters", "016_data_standardization", "017_fmcg_sales_views",
    "018_fmcg_balances", "019_fmcg_control", "020_app_optimizations", "021_app_users", "022_erp_outstanding", "023_sales_clean", "024_employees", "025_company_departments",
    "026_performance_indexes", "027_drop_balance_sheet", "028_financial_and_date_integrity", "029_sales_department_targets", "030_sales_clean_line_key", "031_manual_report_data", "032_tenancy",
    "033_sales_clean_all_lines", "035_settlements", "036_user_access", "037_user_modules", "038_group_daily_sales",
  ]);
  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) return { rows: [...applied].map((id) => ({ id })) };
      return { rows: [] };
    },
  });
  const recordStep = executed.find((step) => step.sql.startsWith("INSERT INTO app.schema_migrations"));
  assert.ok(recordStep, "expected 039 to be recorded");
  assert.deepEqual(recordStep.params, ["039_sales_clean_halve_old_copies"]);
  const sql = executed[executed.indexOf(recordStep) - 1].sql;
  assert.equal((sql.match(/^DO 'BEGIN IF to_regclass\(''public\.invs_fdd_fnb_sales_do_t''\) IS NOT NULL THEN EXECUTE ''/gm) ?? []).length, 10); // two drops, the view, five indexes, the monthly view and its index
  assert.doesNotMatch(sql, /DELETE|TRUNCATE|UPDATE|ALTER|DROP TABLE|CASCADE|INSERT/i);
  assert.match(sql, /copy_no <= \(copy_count \+ 1\) \/ 2/); // half of each group, rounded up, so a line that is there once stays
  assert.match(sql, /"DOC_DATE" < DATE ''''2026-01-01''''/);
  assert.match(sql, /"DOC_DATE" IS NULL OR "DOC_DATE" >= DATE ''''2026-01-01''''/); // a line with no date is kept, as before
  assert.match(sql, /"NET_AMOUNT_WOT" AS "NET_AMOUNT", "NET_COST_WOT" AS "NET_COST"/);
  for (const index of ["doc_date", "dept_date", "date_cust", "cust_no", "item_code"]) assert.match(sql, new RegExp(`CREATE INDEX sales_clean_${index} ON app\.sales_clean`));
});

test("migrate applies 040_sales_daily additively: creates app.sales_daily rollup and indexes guarded by app.sales_clean", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  const applied = new Set([
    "001_baseline", "002_standard_data", "003_drop_report_files", "005_company_expenses", "006_company_branches", "007_company_has_branches", "008_daily_receipts", "009_drop_deals",
    "010_drop_invoices", "011_enterprise_foundation", "012_rejected_rows_loaded", "013_restaurant_cogs", "014_drop_ownership_pct", "015_fmcg_masters", "016_data_standardization", "017_fmcg_sales_views",
    "018_fmcg_balances", "019_fmcg_control", "020_app_optimizations", "021_app_users", "022_erp_outstanding", "023_sales_clean", "024_employees", "025_company_departments",
    "026_performance_indexes", "027_drop_balance_sheet", "028_financial_and_date_integrity", "029_sales_department_targets", "030_sales_clean_line_key", "031_manual_report_data", "032_tenancy",
    "033_sales_clean_all_lines", "035_settlements", "036_user_access", "037_user_modules", "038_group_daily_sales", "039_sales_clean_halve_old_copies",
  ]);
  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) return { rows: [...applied].map((id) => ({ id })) };
      return { rows: [] };
    },
  });
  const recordStep = executed.find((step) => step.sql.startsWith("INSERT INTO app.schema_migrations"));
  assert.ok(recordStep, "expected 040 to be recorded");
  assert.deepEqual(recordStep.params, ["040_sales_daily"]);
  const sql = executed[executed.indexOf(recordStep) - 1].sql;
  assert.equal((sql.match(/^DO 'BEGIN IF to_regclass\(''app\.sales_clean''\) IS NOT NULL THEN EXECUTE ''/gm) ?? []).length, 3);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER)\b/i);
  assert.match(sql, /CREATE MATERIALIZED VIEW IF NOT EXISTS app\.sales_daily AS/);
  assert.match(sql, /GROUP BY "DOC_DATE", "DEPT_CODE", "DOC_TYPE"/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS sales_daily_doc_date ON app\.sales_daily\("DOC_DATE"\)/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS sales_daily_dept_date ON app\.sales_daily\("DEPT_CODE", "DOC_DATE"\)/);
});

test("migrate applies 048_sales_doc_types additively: one new view, sales_clean and its rollups untouched, FINALIZED only", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "048_sales_doc_types");
  const record = executed.find((step) => step.params?.[0] === "048_sales_doc_types");
  assert.ok(record, "expected 048 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.doesNotMatch(sql, /DROP|DELETE|TRUNCATE|UPDATE|ALTER|CASCADE|INSERT/i);
  assert.match(sql, /CREATE MATERIALIZED VIEW app\.sales_doc_types AS/);
  assert.match(sql, /"DOC_TYPE" IN \(''''CR'''',''''DO'''',''''DR'''',''''IN-DTS''''\) AND "TRANS_STATUS" = ''''FINALIZED''''/);
  assert.match(sql, /copy_no <= \(copy_count \+ 1\) \/ 2/); // pre-2026 halving kept
  assert.match(sql, /CREATE INDEX sales_doc_types_doc_date ON app\.sales_doc_types\("DOC_DATE"\)/);
  assert.doesNotMatch(sql, /app\.sales_clean/);
});

test("migrate applies 049_sales_doc_types_all_statuses: only app.sales_doc_types is rebuilt, every status kept as a column", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "049_sales_doc_types_all_statuses");
  const record = executed.find((step) => step.params?.[0] === "049_sales_doc_types_all_statuses");
  assert.ok(record, "expected 049 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.equal((sql.match(/DROP/g) ?? []).length, 1);
  assert.match(sql, /DROP MATERIALIZED VIEW IF EXISTS app\.sales_doc_types/);
  assert.doesNotMatch(sql, /DELETE|TRUNCATE|UPDATE|ALTER|CASCADE|INSERT|app\.sales_clean/i);
  assert.match(sql, /GROUP BY "DOC_DATE", "DOC_TYPE", "TRANS_STATUS"/);
  assert.doesNotMatch(sql, /FINALIZED/i); // the status is filtered when the report reads, not in the view
  assert.match(sql, /copy_no <= \(copy_count \+ 1\) \/ 2/);
});

test("migrate applies 050_sales_clean_trading_types: dependents dropped before sales_clean and rebuilt after it, DO IN-DTS DR CR only, no status filter", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "050_sales_clean_trading_types");
  const record = executed.find((step) => step.params?.[0] === "050_sales_clean_trading_types");
  assert.ok(record, "expected 050 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.doesNotMatch(sql, /DELETE|TRUNCATE|UPDATE|ALTER|DROP TABLE|CASCADE|INSERT/i);
  assert.match(sql, /"DOC_TYPE" IN \(''''DO'''',''''IN-DTS'''',''''DR'''',''''CR''''\)/);
  assert.doesNotMatch(sql, /IN-OT|TRANS_STATUS/);
  assert.match(sql, /copy_no <= \(copy_count \+ 1\) \/ 2/); // pre-2026 halving kept
  const at = (text: string) => sql.indexOf(text);
  for (const rollup of ["sales_customer_daily", "sales_daily_dims", "sales_daily", "sales_monthly"]) assert.ok(at(`DROP MATERIALIZED VIEW IF EXISTS app.${rollup}`) < at("DROP MATERIALIZED VIEW IF EXISTS app.sales_clean"), `${rollup} dropped first`);
  for (const rollup of ["app.sales_monthly", "app.sales_daily AS", "app.sales_daily_dims AS", "app.sales_customer_daily AS"]) assert.ok(at("CREATE MATERIALIZED VIEW app.sales_clean") < sql.lastIndexOf(rollup), `${rollup} rebuilt after`);
});

test("migrate applies 041_supplier_ageing additively: one new table, nothing dropped or altered", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      if (sql.startsWith("SELECT id FROM app.schema_migrations")) return { rows: [] };
      return { rows: [] };
    },
  }, "041_supplier_ageing");
  const record = executed.find((step) => step.params?.[0] === "041_supplier_ageing");
  assert.ok(record, "expected 041 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.match(sql, /CREATE TABLE app\.supplier_ageing/);
  assert.match(sql, /PRIMARY KEY\(as_of, account_no\)/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER)\b/i);
});

test("migrate applies 042_follow_mode additively: two new tables, nothing dropped or altered", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      return { rows: [] };
    },
  }, "042_follow_mode");
  const record = executed.find((step) => step.params?.[0] === "042_follow_mode");
  assert.ok(record, "expected 042 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.match(sql, /CREATE TABLE app\.user_presence/);
  assert.match(sql, /CREATE TABLE app\.follow_requests/);
  assert.doesNotMatch(sql, /(DROP|DELETE|TRUNCATE|UPDATE|ALTER)/i);
});

test("migrate applies 043_logistics_profitability additively: one new table, nothing dropped or altered", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "043_logistics_profitability");
  const record = executed.find((step) => step.params?.[0] === "043_logistics_profitability");
  assert.ok(record, "expected 043 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.match(sql, /CREATE TABLE app\.logistics_profitability/);
  assert.match(sql, /PRIMARY KEY\(year, month, line\)/);
  assert.doesNotMatch(sql, /(DROP|DELETE|TRUNCATE|UPDATE|ALTER)/i);
});

test("migrate applies 044_brand_budget additively: two new tables, nothing dropped or altered", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "044_brand_budget");
  const record = executed.find((step) => step.params?.[0] === "044_brand_budget");
  assert.ok(record, "expected 044 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.match(sql, /CREATE TABLE app\.brand_plan_years/);
  assert.match(sql, /CREATE TABLE app\.brand_plan_months/);
  assert.doesNotMatch(sql, /(DROP|DELETE|TRUNCATE|UPDATE|ALTER)/i);
});

test("migrate applies 045_pos_reports additively: four new tables, nothing dropped or altered", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "045_pos_reports");
  const record = executed.find((step) => step.params?.[0] === "045_pos_reports");
  assert.ok(record, "expected 045 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  for (const table of ["pos_daily_sales", "pos_item_sales", "pos_purchases", "pos_stock"]) assert.match(sql, new RegExp(`CREATE TABLE app\.${table}`));
  assert.doesNotMatch(sql, /(DROP|DELETE|TRUNCATE|UPDATE|ALTER)/i);
});

test("migrate applies 046_bank_position additively: one new table, nothing dropped or altered", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "046_bank_position");
  const record = executed.find((step) => step.params?.[0] === "046_bank_position");
  assert.ok(record, "expected 046 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.match(sql, /CREATE TABLE app.bank_position/);
  assert.doesNotMatch(sql, /(DROP|DELETE|TRUNCATE|UPDATE|ALTER)/i);
});

test("migrate applies 047_sales_rollups additively: creates daily dims and customer rollups guarded by app.sales_clean", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({ query: async (sql, params) => { executed.push({ sql, params }); return { rows: [] }; } }, "047_sales_rollups");
  const record = executed.find((step) => step.params?.[0] === "047_sales_rollups");
  assert.ok(record, "expected 047 to be recorded");
  const sql = executed[executed.indexOf(record) - 1].sql;
  assert.equal((sql.match(/^DO 'BEGIN IF to_regclass\(''app\.sales_clean''\) IS NOT NULL THEN EXECUTE ''/gm) ?? []).length, 8);
  assert.match(sql, /CREATE MATERIALIZED VIEW IF NOT EXISTS app\.sales_daily_dims AS/);
  assert.match(sql, /CREATE MATERIALIZED VIEW IF NOT EXISTS app\.sales_customer_daily AS/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER)\b/i);
});
