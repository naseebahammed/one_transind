// Database readers and manual-entry writers for existing report tables and the additive 031_manual_report_data tables.
import { numbering, q } from "@/lib/db";
import type { GridSection } from "@/lib/company-data";
import { linesOf } from "@/lib/company-figures";
import { branchClash, monthlySalesClash, takingsClash } from "@/lib/figure-rules";
import type { ManualDailyStay } from "@/lib/manual-entry-input";
import { roundMoney, sumMoney } from "@/lib/money";

const monthPeriod = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}-01`;

export type PnlCellRow = {
  month: number;
  main: string;
  line: string;
  value: number;
  isManual: boolean;
};

export async function listCompanySectionYear(
  companyId: number,
  section: string,
  year: number,
  branchId: number | null,
): Promise<(PnlCellRow & { unitType: string })[]> {
  return q<PnlCellRow & { unitType: string }>(
    `SELECT EXTRACT(month FROM period)::int - 1 AS month, main, line, unit_type AS "unitType",
            value::float8 AS value, (import_id IS NULL) AS "isManual"
     FROM app.company_figures
     WHERE company_id = $1 AND section = $2
       AND period >= make_date($3::int, 1, 1) AND period < make_date($3::int + 1, 1, 1)
       AND branch_id IS NOT DISTINCT FROM $4
     ORDER BY period, main, line, unit_type`,
    [companyId, section, year, branchId],
  );
}

export async function deleteCompanyFigureEntry(
  companyId: number,
  section: string,
  year: number,
  month: number,
  main: string,
  line: string,
  unitType: string,
  branchId: number | null,
) {
  await q(
    `DELETE FROM app.company_figures
     WHERE company_id = $1 AND section = $2 AND period = $3::date
       AND main = $4 AND line = $5 AND unit_type = $6
       AND branch_id IS NOT DISTINCT FROM $7`,
    [companyId, section, monthPeriod(year, month), main, line, unitType, branchId],
  );
}

export async function saveManualMonthlySection(
  companyId: number,
  section: GridSection,
  year: number,
  month: number,
  entries: { line: string; value: number }[],
  branchId: number | null,
): Promise<string | null> {
  const p = monthPeriod(year, month);
  const groups = await linesOf(section);
  for (const entry of entries) {
    if (!groups.has(entry.line)) return `Unknown line "${entry.line}".`;
  }
  return numbering(async (c) => {
    const clash =
      (await branchClash(c, companyId, section, [p], branchId)) ??
      (section === "sales" ? await monthlySalesClash(c, companyId, [p]) : null);
    if (clash) return clash;
    await c.query(
      `INSERT INTO app.company_figures(company_id, section, period, main, line, unit_type, value, import_id, branch_id)
       SELECT $1, $2, $3::date, m, l, '', v, NULL, $4
       FROM unnest($5::text[], $6::text[], $7::numeric[]) AS t(m, l, v)
       ON CONFLICT ON CONSTRAINT company_figures_key
       DO UPDATE SET value = EXCLUDED.value, import_id = NULL, updated = now()`,
      [
        companyId,
        section,
        p,
        branchId,
        entries.map((e) => groups.get(e.line)!),
        entries.map((e) => e.line),
        entries.map((e) => roundMoney(e.value)),
      ],
    );
    return null;
  }, companyId);
}

export type DailyStayRow = Omit<ManualDailyStay, "companyId" | "branchId"> & { isManual: boolean };

export async function listDailyStayMonth(
  companyId: number,
  year: number,
  month: number,
  branchId: number | null,
): Promise<DailyStayRow[]> {
  return q<DailyStayRow>(
    `SELECT to_char(date, 'YYYY-MM-DD') AS date,
            long_guests::float8 AS long_guests, long_rate::float8 AS long_rate, long_total::float8 AS long_total,
            short_guests::float8 AS short_guests, short_rate::float8 AS short_rate, short_total::float8 AS short_total,
            rooms_occupied::float8 AS rooms_occupied, room_revenue::float8 AS room_revenue,
            other_revenue::float8 AS other_revenue, rooms_available::float8 AS rooms_available,
            (import_id IS NULL) AS "isManual"
     FROM app.daily_sales
     WHERE company_id = $1 AND branch_id IS NOT DISTINCT FROM $2
       AND date >= make_date($3::int, $4::int + 1, 1)
       AND date < (make_date($3::int, $4::int + 1, 1) + interval '1 month')::date
     ORDER BY date`,
    [companyId, branchId, year, month],
  );
}

export async function saveDailyStayRow(d: ManualDailyStay) {
  await numbering(async (c) => {
    await c.query(
      `INSERT INTO app.daily_sales(
         company_id, branch_id, date,
         long_guests, long_rate, long_total,
         short_guests, short_rate, short_total,
         rooms_occupied, room_revenue, other_revenue, rooms_available, import_id
       )
       VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL)
       ON CONFLICT ON CONSTRAINT daily_sales_key DO UPDATE SET
         long_guests = EXCLUDED.long_guests,
         long_rate = EXCLUDED.long_rate,
         long_total = EXCLUDED.long_total,
         short_guests = EXCLUDED.short_guests,
         short_rate = EXCLUDED.short_rate,
         short_total = EXCLUDED.short_total,
         rooms_occupied = EXCLUDED.rooms_occupied,
         room_revenue = EXCLUDED.room_revenue,
         other_revenue = EXCLUDED.other_revenue,
         rooms_available = EXCLUDED.rooms_available,
         import_id = NULL,
         updated = now()`,
      [
        d.companyId,
        d.branchId,
        d.date,
        d.long_guests,
        d.long_rate,
        d.long_total,
        d.short_guests,
        d.short_rate,
        d.short_total,
        d.rooms_occupied,
        d.room_revenue,
        d.other_revenue,
        d.rooms_available,
      ],
    );
  }, d.companyId);
}

export async function deleteDailyStayRow(companyId: number, date: string, branchId: number | null) {
  await q(
    "DELETE FROM app.daily_sales WHERE company_id = $1 AND date = $2::date AND branch_id IS NOT DISTINCT FROM $3",
    [companyId, date, branchId],
  );
}

export async function saveUnitTypesMonth(
  companyId: number,
  year: number,
  month: number,
  unitType: string,
  entries: { line: string; value: number }[],
  branchId: number | null,
): Promise<string | null> {
  const p = monthPeriod(year, month);
  return numbering(async (c) => {
    const clash = await branchClash(c, companyId, "units", [p], branchId);
    if (clash) return clash;
    await c.query(
      `INSERT INTO app.company_figures(company_id, section, period, main, line, unit_type, value, import_id, branch_id)
       SELECT $1, 'units', $2::date, 'UNITS', l, $3, v, NULL, $4
       FROM unnest($5::text[], $6::numeric[]) AS t(l, v)
       ON CONFLICT ON CONSTRAINT company_figures_key
       DO UPDATE SET value = EXCLUDED.value, import_id = NULL, updated = now()`,
      [companyId, p, unitType, branchId, entries.map((e) => e.line), entries.map((e) => roundMoney(e.value))],
    );
    return null;
  }, companyId);
}

export async function deleteUnitTypesMonth(
  companyId: number,
  year: number,
  month: number,
  unitType: string,
  branchId: number | null,
) {
  await q(
    `DELETE FROM app.company_figures
     WHERE company_id = $1 AND section = 'units' AND period = $2::date
       AND unit_type = $3 AND branch_id IS NOT DISTINCT FROM $4`,
    [companyId, monthPeriod(year, month), unitType, branchId],
  );
}

export async function saveDailyReceiptDay(
  companyId: number,
  branchId: number,
  date: string,
  entries: { line: string; value: number }[],
): Promise<string | null> {
  const p = `${date.slice(0, 7)}-01`;
  return numbering(async (c) => {
    const clash = await takingsClash(c, companyId, [p]);
    if (clash) return clash;
    await c.query(
      "INSERT INTO app.payment_channels(name) SELECT DISTINCT l FROM unnest($1::text[]) AS t(l) WHERE btrim(l) <> '' ON CONFLICT DO NOTHING",
      [entries.map((e) => e.line)],
    );
    await c.query(
      `INSERT INTO app.daily_receipts(company_id, branch_id, date, line, value, import_id)
       SELECT $1, $2, $3::date, l, v, NULL
       FROM unnest($4::text[], $5::numeric[]) AS t(l, v)
       ON CONFLICT (branch_id, date, line)
       DO UPDATE SET value = EXCLUDED.value, import_id = NULL, updated = now()`,
      [companyId, branchId, date, entries.map((e) => e.line), entries.map((e) => roundMoney(e.value))],
    );
    return null;
  }, companyId);
}

export async function deleteDailyReceiptEntry(branchId: number, date: string, line?: string) {
  if (line) {
    await q("DELETE FROM app.daily_receipts WHERE branch_id = $1 AND date = $2::date AND line = $3", [branchId, date, line]);
  } else {
    await q("DELETE FROM app.daily_receipts WHERE branch_id = $1 AND date = $2::date", [branchId, date]);
  }
}

export async function saveCogsMonthEntries(
  companyId: number,
  year: number,
  month: number,
  entries: { line: string; value: number }[],
  branchId: number | null,
): Promise<string | null> {
  const p = monthPeriod(year, month);
  return numbering(async (c) => {
    const clash = await branchClash(c, companyId, "cogs", [p], branchId);
    if (clash) return clash;
    await c.query(
      `INSERT INTO app.company_figures(company_id, section, period, main, line, unit_type, value, import_id, branch_id)
       SELECT $1, 'cogs', $2::date, 'COGS', l, '', v, NULL, $3
       FROM unnest($4::text[], $5::numeric[]) AS t(l, v)
       ON CONFLICT ON CONSTRAINT company_figures_key
       DO UPDATE SET value = EXCLUDED.value, import_id = NULL, updated = now()`,
      [companyId, p, branchId, entries.map((e) => e.line), entries.map((e) => roundMoney(e.value))],
    );
    return null;
  }, companyId);
}

export async function deleteCogsMonthEntries(companyId: number, year: number, month: number, branchId: number | null) {
  await q(
    `DELETE FROM app.company_figures
     WHERE company_id = $1 AND section = 'cogs' AND period = $2::date AND branch_id IS NOT DISTINCT FROM $3`,
    [companyId, monthPeriod(year, month), branchId],
  );
}

// --- Direct manual HR employee record save/delete ---

export async function saveManualEmployeeRecord(e: {
  id: string;
  name: string;
  department: string;
  designation: string;
  nationality: string;
  joined: string;
  left: string | null;
}) {
  await q(
    `INSERT INTO app.employees(id, name, department, designation, nationality, joined, left_on)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::date)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       department = EXCLUDED.department,
       designation = EXCLUDED.designation,
       nationality = EXCLUDED.nationality,
       joined = EXCLUDED.joined,
       left_on = EXCLUDED.left_on,
       updated = now()`,
    [e.id, e.name, e.department, e.designation, e.nationality, e.joined, e.left],
  );
}

export async function deleteEmployeeRecord(id: string) {
  await q("DELETE FROM app.employees WHERE id = $1", [id]);
}

// --- FMCG manual reference, target, stock, and control records ---

export type FmcgBrandRow = { code: string; name: string; department: string | null; manager: string | null; category: string | null };
export type FmcgSalesmanRow = { code: string; name: string; status: string; teamLead: string | null; manager: string | null; salesCategory: string | null; route: string | null };
export type FmcgCustomerRow = { code: string; name: string; groupName: string | null; creditDays: number | null; accountant: string | null; status: string; balance: number | null };
export type FmcgItemRow = { code: string; name: string; brand: string; packing: string | null; size: string | null; itemType: string | null; department: string | null; manager: string | null };
export type FmcgAssignmentRow = { period: string; salesmanCode: string; salesmanName: string; brand: string; supervisor: string | null; channel: string | null; department: string | null; target: number };
export type FmcgManagerTargetRow = { period: string; manager: string; target: number };
export type FmcgStockSnapshotRow = { asOf: string; itemCode: string; itemName: string; brand: string; location: string; qtyCurrent: number; qtyAllocated: number; qtyBalance: number; value: number };
export type FmcgDeliveryVarianceRow = { doDate: string; doNo: string; itemCode: string; item: string | null; location: string; customer: string | null; qtyRv: number; qtyDo: number; valueRv: number; valueDo: number };
export type FmcgConsignmentRow = { receivedDate: string; lineNo: number; consignmentNo: string; supplier: string | null; itemCode: string; item: string | null; billedQty: number; receivedQty: number };
export type FmcgStockExpiryRow = { asOf: string; report: string; lineNo: number; itemCode: string; item: string | null; brand: string | null; location: string | null; totalCost: number; expiryDate: string };

export async function listFmcgManualOverview(period: string) {
  const [brands, salesmen, customers, items, assignments, managerTargets, stock, variances, consignments, expiry] = await Promise.all([
    q<FmcgBrandRow>("SELECT code, name, department, manager, category FROM app.brands ORDER BY code LIMIT 100"),
    q<FmcgSalesmanRow>(
      `SELECT code, name, status, team_lead AS "teamLead", manager, sales_category AS "salesCategory", route
       FROM app.salesmen ORDER BY code LIMIT 100`,
    ),
    q<FmcgCustomerRow>(
      `SELECT code, name, group_name AS "groupName", credit_days AS "creditDays", accountant, status, balance::float8 AS balance
       FROM app.customers ORDER BY updated DESC, code LIMIT 80`,
    ),
    q<FmcgItemRow>(
      `SELECT code, name, brand, packing, size, item_type AS "itemType", department, manager
       FROM app.items ORDER BY updated DESC, code LIMIT 80`,
    ),
    q<FmcgAssignmentRow>(
      `SELECT to_char(a.period, 'YYYY-MM-DD') AS period, a.salesman_code AS "salesmanCode",
              COALESCE(s.name, a.salesman_code) AS "salesmanName", a.brand, a.supervisor, a.channel, a.department,
              COALESCE(a.target, 0)::float8 AS target
       FROM app.sales_assignments a LEFT JOIN app.salesmen s ON s.code = a.salesman_code
       WHERE a.period = $1::date ORDER BY a.salesman_code, a.brand LIMIT 150`,
      [period],
    ),
    q<FmcgManagerTargetRow>(
      `SELECT to_char(period, 'YYYY-MM-DD') AS period, manager, target::float8 AS target
       FROM app.manager_targets WHERE period = $1::date ORDER BY manager`,
      [period],
    ),
    q<FmcgStockSnapshotRow>(
      `SELECT to_char(s.as_of, 'YYYY-MM-DD') AS "asOf", s.item_code AS "itemCode",
              i.name AS "itemName", i.brand, s.location,
              s.qty_current::float8 AS "qtyCurrent", s.qty_allocated::float8 AS "qtyAllocated",
              s.qty_balance::float8 AS "qtyBalance", s.value::float8 AS value
       FROM app.stock_snapshots s JOIN app.items i ON i.code = s.item_code
       ORDER BY s.as_of DESC, s.item_code, s.location LIMIT 60`,
    ),
    q<FmcgDeliveryVarianceRow>(
      `SELECT to_char(do_date, 'YYYY-MM-DD') AS "doDate", do_no AS "doNo", item_code AS "itemCode",
              item, location, customer, qty_rv::float8 AS "qtyRv", qty_do::float8 AS "qtyDo",
              value_rv::float8 AS "valueRv", value_do::float8 AS "valueDo"
       FROM app.delivery_variances ORDER BY do_date DESC, do_no LIMIT 60`,
    ),
    q<FmcgConsignmentRow>(
      `SELECT to_char(received_date, 'YYYY-MM-DD') AS "receivedDate", line_no AS "lineNo",
              consignment_no AS "consignmentNo", supplier, item_code AS "itemCode", item,
              billed_qty::float8 AS "billedQty", received_qty::float8 AS "receivedQty"
       FROM app.consignment_receipts ORDER BY received_date DESC, line_no LIMIT 60`,
    ),
    q<FmcgStockExpiryRow>(
      `SELECT to_char(as_of, 'YYYY-MM-DD') AS "asOf", report, line_no AS "lineNo", item_code AS "itemCode",
              item, brand, location, total_cost::float8 AS "totalCost", to_char(expiry_date, 'YYYY-MM-DD') AS "expiryDate"
       FROM app.stock_expiry ORDER BY as_of DESC, report, line_no LIMIT 60`,
    ),
  ]);
  return { brands, salesmen, customers, items, assignments, managerTargets, stock, variances, consignments, expiry };
}

export async function saveFmcgBrand(b: FmcgBrandRow) {
  await q(
    `INSERT INTO app.brands(code, name, department, manager, category)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       department = EXCLUDED.department,
       manager = EXCLUDED.manager,
       category = EXCLUDED.category`,
    [b.code, b.name, b.department, b.manager, b.category],
  );
}

export async function deleteFmcgBrand(code: string): Promise<string | null> {
  try {
    await q("DELETE FROM app.brands WHERE code = $1", [code]);
    return null;
  } catch (e) {
    if ((e as { code?: string }).code === "23503") return "This brand is still referenced by items or targets.";
    throw e;
  }
}

export async function saveFmcgSalesman(s: FmcgSalesmanRow) {
  await q(
    `INSERT INTO app.salesmen(code, name, status, team_lead, manager, sales_category, route, import_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       status = EXCLUDED.status,
       team_lead = EXCLUDED.team_lead,
       manager = EXCLUDED.manager,
       sales_category = EXCLUDED.sales_category,
       route = EXCLUDED.route,
       import_id = NULL,
       updated = now()`,
    [s.code, s.name, s.status, s.teamLead, s.manager, s.salesCategory, s.route],
  );
}

export async function deleteFmcgSalesman(code: string): Promise<string | null> {
  try {
    await q("DELETE FROM app.salesmen WHERE code = $1", [code]);
    return null;
  } catch (e) {
    if ((e as { code?: string }).code === "23503") return "This salesman is still referenced by monthly sales targets.";
    throw e;
  }
}

export async function saveFmcgCustomer(c: FmcgCustomerRow) {
  await q(
    `INSERT INTO app.customers(code, name, group_name, credit_days, accountant, status, balance, import_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       group_name = EXCLUDED.group_name,
       credit_days = EXCLUDED.credit_days,
       accountant = EXCLUDED.accountant,
       status = EXCLUDED.status,
       balance = EXCLUDED.balance,
       import_id = NULL,
       updated = now()`,
    [c.code, c.name, c.groupName, c.creditDays, c.accountant, c.status, c.balance],
  );
}

export async function deleteFmcgCustomer(code: string): Promise<string | null> {
  try {
    await q("DELETE FROM app.customers WHERE code = $1", [code]);
    return null;
  } catch (e) {
    if ((e as { code?: string }).code === "23503") return "This customer is still referenced by other records.";
    throw e;
  }
}

export async function saveFmcgItem(i: FmcgItemRow) {
  await q("INSERT INTO app.brands(code, name) VALUES ($1, $1) ON CONFLICT (code) DO NOTHING", [i.brand]);
  await q(
    `INSERT INTO app.items(code, name, brand, packing, size, item_type, department, manager, import_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       brand = EXCLUDED.brand,
       packing = EXCLUDED.packing,
       size = EXCLUDED.size,
       item_type = EXCLUDED.item_type,
       department = EXCLUDED.department,
       manager = EXCLUDED.manager,
       import_id = NULL,
       updated = now()`,
    [i.code, i.name, i.brand, i.packing, i.size, i.itemType, i.department, i.manager],
  );
}

export async function deleteFmcgItem(code: string): Promise<string | null> {
  try {
    await q("DELETE FROM app.items WHERE code = $1", [code]);
    return null;
  } catch (e) {
    if ((e as { code?: string }).code === "23503") return "This item is still referenced by stock snapshots.";
    throw e;
  }
}

export async function saveFmcgSalesAssignment(a: FmcgAssignmentRow) {
  await q("INSERT INTO app.brands(code, name) VALUES ($1, $1) ON CONFLICT (code) DO NOTHING", [a.brand]);
  await q("INSERT INTO app.salesmen(code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING", [a.salesmanCode, a.salesmanName]);
  await q(
    `INSERT INTO app.sales_assignments(period, salesman_code, brand, supervisor, channel, department, target, import_id)
     VALUES ($1::date, $2, $3, $4, $5, $6, $7, NULL)
     ON CONFLICT (period, salesman_code, brand) DO UPDATE SET
       supervisor = EXCLUDED.supervisor,
       channel = EXCLUDED.channel,
       department = EXCLUDED.department,
       target = EXCLUDED.target,
       import_id = NULL`,
    [a.period, a.salesmanCode, a.brand, a.supervisor, a.channel, a.department, roundMoney(a.target)],
  );
}

export async function deleteFmcgSalesAssignment(period: string, salesmanCode: string, brand: string) {
  await q("DELETE FROM app.sales_assignments WHERE period = $1::date AND salesman_code = $2 AND brand = $3", [period, salesmanCode, brand]);
}

export async function saveFmcgManagerTarget(t: FmcgManagerTargetRow) {
  await q(
    `INSERT INTO app.manager_targets(period, manager, target, import_id)
     VALUES ($1::date, $2, $3, NULL)
     ON CONFLICT (period, manager) DO UPDATE SET target = EXCLUDED.target, import_id = NULL`,
    [t.period, t.manager, roundMoney(t.target)],
  );
}

export async function deleteFmcgManagerTarget(period: string, manager: string) {
  await q("DELETE FROM app.manager_targets WHERE period = $1::date AND manager = $2", [period, manager]);
}

export async function saveFmcgStockSnapshot(s: FmcgStockSnapshotRow) {
  await q("INSERT INTO app.brands(code, name) VALUES ($1, $1) ON CONFLICT (code) DO NOTHING", [s.brand]);
  await q(
    "INSERT INTO app.items(code, name, brand) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING",
    [s.itemCode, s.itemName, s.brand],
  );
  await q(
    `INSERT INTO app.stock_snapshots(as_of, item_code, location, qty_current, qty_allocated, qty_balance, value, import_id)
     VALUES ($1::date, $2, $3, $4, $5, $6, $7, NULL)
     ON CONFLICT (as_of, item_code, location) DO UPDATE SET
       qty_current = EXCLUDED.qty_current,
       qty_allocated = EXCLUDED.qty_allocated,
       qty_balance = EXCLUDED.qty_balance,
       value = EXCLUDED.value,
       import_id = NULL`,
    [s.asOf, s.itemCode, s.location, s.qtyCurrent, s.qtyAllocated, s.qtyBalance, roundMoney(s.value)],
  );
}

export async function deleteFmcgStockSnapshot(asOf: string, itemCode: string, location: string) {
  await q("DELETE FROM app.stock_snapshots WHERE as_of = $1::date AND item_code = $2 AND location = $3", [asOf, itemCode, location]);
}

export async function saveFmcgDeliveryVariance(v: {
  doDate: string; doNo: string; itemCode: string; location: string; customerCode: string | null; customer: string | null;
  salesman: string | null; storeInCharge: string | null; driver: string | null; item: string | null; brand: string | null;
  manager: string | null; supervisor: string | null; qtyRv: number; qtyDo: number; valueRv: number; valueDo: number;
}) {
  await q(
    `INSERT INTO app.delivery_variances(
       do_date, do_no, item_code, location, customer_code, customer, salesman, store_in_charge, driver,
       item, brand, manager, supervisor, qty_rv, qty_do, value_rv, value_do, import_id
     )
     VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NULL)
     ON CONFLICT (do_no, item_code, location) DO UPDATE SET
       do_date = EXCLUDED.do_date,
       customer_code = EXCLUDED.customer_code,
       customer = EXCLUDED.customer,
       salesman = EXCLUDED.salesman,
       store_in_charge = EXCLUDED.store_in_charge,
       driver = EXCLUDED.driver,
       item = EXCLUDED.item,
       brand = EXCLUDED.brand,
       manager = EXCLUDED.manager,
       supervisor = EXCLUDED.supervisor,
       qty_rv = EXCLUDED.qty_rv,
       qty_do = EXCLUDED.qty_do,
       value_rv = EXCLUDED.value_rv,
       value_do = EXCLUDED.value_do,
       import_id = NULL`,
    [
      v.doDate, v.doNo, v.itemCode, v.location, v.customerCode, v.customer, v.salesman, v.storeInCharge, v.driver,
      v.item, v.brand, v.manager, v.supervisor, v.qtyRv, v.qtyDo, roundMoney(v.valueRv), roundMoney(v.valueDo),
    ],
  );
}

export async function deleteFmcgDeliveryVariance(doNo: string, itemCode: string, location: string) {
  await q("DELETE FROM app.delivery_variances WHERE do_no = $1 AND item_code = $2 AND location = $3", [doNo, itemCode, location]);
}

export async function saveFmcgConsignment(c: {
  receivedDate: string; lineNo: number; consignmentNo: string; orderNo: string | null; invoiceNo: string | null;
  invoiceDate: string | null; supplier: string | null; location: string | null; itemCode: string; item: string | null;
  expiryDate: string | null; excise: string | null; billedQty: number; receivedQty: number;
}) {
  await q(
    `INSERT INTO app.consignment_receipts(
       received_date, line_no, consignment_no, order_no, invoice_no, invoice_date, supplier, location,
       item_code, item, expiry_date, excise, billed_qty, received_qty, import_id
     )
     VALUES ($1::date, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11::date, $12, $13, $14, NULL)
     ON CONFLICT (received_date, line_no) DO UPDATE SET
       consignment_no = EXCLUDED.consignment_no,
       order_no = EXCLUDED.order_no,
       invoice_no = EXCLUDED.invoice_no,
       invoice_date = EXCLUDED.invoice_date,
       supplier = EXCLUDED.supplier,
       location = EXCLUDED.location,
       item_code = EXCLUDED.item_code,
       item = EXCLUDED.item,
       expiry_date = EXCLUDED.expiry_date,
       excise = EXCLUDED.excise,
       billed_qty = EXCLUDED.billed_qty,
       received_qty = EXCLUDED.received_qty,
       import_id = NULL`,
    [
      c.receivedDate, c.lineNo, c.consignmentNo, c.orderNo, c.invoiceNo, c.invoiceDate, c.supplier,
      c.location, c.itemCode, c.item, c.expiryDate, c.excise, c.billedQty, c.receivedQty,
    ],
  );
}

export async function deleteFmcgConsignment(receivedDate: string, lineNo: number) {
  await q("DELETE FROM app.consignment_receipts WHERE received_date = $1::date AND line_no = $2", [receivedDate, lineNo]);
}

export async function saveFmcgStockExpiry(e: {
  asOf: string; report: string; lineNo: number; itemCode: string; item: string | null; size: string | null;
  packing: string | null; brand: string | null; category: string | null; location: string | null;
  cartons: number | null; outers: number | null; pieces: number | null; totalCost: number; expiryDate: string; remarks: string | null;
}) {
  await q(
    `INSERT INTO app.stock_expiry(
       as_of, report, line_no, item_code, item, size, packing, brand, category, location,
       cartons, outers, pieces, total_cost, expiry_date, remarks, import_id
     )
     VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::date, $16, NULL)
     ON CONFLICT (as_of, report, line_no) DO UPDATE SET
       item_code = EXCLUDED.item_code,
       item = EXCLUDED.item,
       size = EXCLUDED.size,
       packing = EXCLUDED.packing,
       brand = EXCLUDED.brand,
       category = EXCLUDED.category,
       location = EXCLUDED.location,
       cartons = EXCLUDED.cartons,
       outers = EXCLUDED.outers,
       pieces = EXCLUDED.pieces,
       total_cost = EXCLUDED.total_cost,
       expiry_date = EXCLUDED.expiry_date,
       remarks = EXCLUDED.remarks,
       import_id = NULL`,
    [
      e.asOf, e.report, e.lineNo, e.itemCode, e.item, e.size, e.packing, e.brand, e.category,
      e.location, e.cartons, e.outers, e.pieces, roundMoney(e.totalCost), e.expiryDate, e.remarks,
    ],
  );
}

export async function deleteFmcgStockExpiry(asOf: string, report: string, lineNo: number) {
  await q("DELETE FROM app.stock_expiry WHERE as_of = $1::date AND report = $2 AND line_no = $3", [asOf, report, lineNo]);
}

// --- New 031_manual_report_data readers and writers ---

const isMissingTable = (e: unknown) => (e as { code?: string })?.code === "42P01";
async function qSafe<T>(text: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await q<T>(text, params);
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}
async function q1Safe<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await qSafe<T>(text, params))[0];
}

export type ReceivablesSnapshotRow = {
  id: number;
  companyId: number | null;
  companyName: string | null;
  asOf: string;
  dsoDays: number | null;
  notDue: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
};

export async function listReceivablesSnapshots(): Promise<ReceivablesSnapshotRow[]> {
  const rows = await qSafe<Omit<ReceivablesSnapshotRow, "total">>(
    `SELECT r.id, r.company_id AS "companyId", c.name AS "companyName",
            to_char(r.as_of, 'YYYY-MM-DD') AS "asOf", r.dso_days::float8 AS "dsoDays",
            r.not_due::float8 AS "notDue", r.days_1_30::float8 AS "days1To30",
            r.days_31_60::float8 AS "days31To60", r.days_61_90::float8 AS "days61To90",
            r.over_90::float8 AS "over90"
     FROM app.receivables_snapshots r
     LEFT JOIN app.companies c ON c.id = r.company_id
     ORDER BY c.name NULLS FIRST, r.id`,
  );
  return rows.map((r) => ({
    ...r,
    total: sumMoney([r.notDue, r.days1To30, r.days31To60, r.days61To90, r.over90]),
  }));
}

export async function saveReceivablesSnapshot(d: {
  companyId: number | null;
  asOf: string;
  dsoDays: number | null;
  notDue: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
}) {
  await q(
    `INSERT INTO app.receivables_snapshots(company_id, as_of, dso_days, not_due, days_1_30, days_31_60, days_61_90, over_90)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)
     ON CONFLICT ON CONSTRAINT receivables_snapshots_company_key DO UPDATE SET
       as_of = EXCLUDED.as_of,
       dso_days = EXCLUDED.dso_days,
       not_due = EXCLUDED.not_due,
       days_1_30 = EXCLUDED.days_1_30,
       days_31_60 = EXCLUDED.days_31_60,
       days_61_90 = EXCLUDED.days_61_90,
       over_90 = EXCLUDED.over_90,
       updated = now()`,
    [d.companyId, d.asOf, d.dsoDays, d.notDue, d.days1To30, d.days31To60, d.days61To90, d.over90],
  );
}

export async function deleteReceivablesSnapshot(id: number) {
  await q("DELETE FROM app.receivables_snapshots WHERE id = $1", [id]);
}

export type OverdueInvoiceRow = {
  id: number;
  invoiceNo: string;
  accountName: string;
  companyId: number | null;
  companyName: string | null;
  dueDate: string;
  amount: number;
  balance: number;
  status: string;
};

export async function listOverdueInvoices(): Promise<OverdueInvoiceRow[]> {
  return qSafe<OverdueInvoiceRow>(
    `SELECT i.id, i.invoice_no AS "invoiceNo", i.account_name AS "accountName",
            i.company_id AS "companyId", c.name AS "companyName",
            to_char(i.due_date, 'YYYY-MM-DD') AS "dueDate",
            i.amount::float8 AS amount, i.balance::float8 AS balance, i.status
     FROM app.overdue_invoices i
     LEFT JOIN app.companies c ON c.id = i.company_id
     ORDER BY i.due_date ASC, i.balance DESC, i.id DESC`,
  );
}

export async function saveOverdueInvoice(d: {
  invoiceNo: string;
  accountName: string;
  companyId: number | null;
  dueDate: string;
  amount: number;
  balance: number;
  status: string;
}) {
  await q(
    `INSERT INTO app.overdue_invoices(invoice_no, account_name, company_id, due_date, amount, balance, status)
     VALUES ($1, $2, $3, $4::date, $5, $6, $7)
     ON CONFLICT (invoice_no) DO UPDATE SET
       account_name = EXCLUDED.account_name,
       company_id = EXCLUDED.company_id,
       due_date = EXCLUDED.due_date,
       amount = EXCLUDED.amount,
       balance = EXCLUDED.balance,
       status = EXCLUDED.status,
       updated = now()`,
    [d.invoiceNo, d.accountName, d.companyId, d.dueDate, d.amount, d.balance, d.status],
  );
}

export async function deleteOverdueInvoice(id: number) {
  await q("DELETE FROM app.overdue_invoices WHERE id = $1", [id]);
}

export type LogisticsKpisRow = {
  fleetCount: number | null;
  onRouteCount: number | null;
  outletsReached: number | null;
};

export type FleetVehicleRow = {
  id: number;
  vehicleNo: string;
  vehicleType: string;
  driverName: string;
  route: string;
  temperatureMode: string;
  status: string;
};

export type ShipmentRow = {
  id: number;
  shipmentCode: string;
  destination: string;
  temperature: string;
  vehicle: string;
  eta: string;
  status: string;
};

export type WarehouseRow = {
  id: number;
  name: string;
  location: string;
  temperatureZone: string;
  capacityPallets: number;
  occupiedPallets: number;
  status: string;
};

export type CustomsRow = {
  id: number;
  bolNo: string;
  customer: string;
  port: string;
  eta: string | null;
  status: string;
};

export async function getLogisticsOverview() {
  const [kpis, fleet, shipments, warehouses, customs] = await Promise.all([
    q1Safe<LogisticsKpisRow>(
      `SELECT fleet_count AS "fleetCount", on_route_count AS "onRouteCount", outlets_reached AS "outletsReached"
       FROM app.logistics_kpis WHERE id = 1`,
    ),
    qSafe<FleetVehicleRow>(
      `SELECT id, vehicle_no AS "vehicleNo", vehicle_type AS "vehicleType", driver_name AS "driverName",
              route, temperature_mode AS "temperatureMode", status
       FROM app.logistics_fleet ORDER BY vehicle_no`,
    ),
    qSafe<ShipmentRow>(
      `SELECT id, shipment_code AS "shipmentCode", destination, temperature, vehicle, eta, status
       FROM app.logistics_shipments ORDER BY updated DESC, id DESC`,
    ),
    qSafe<WarehouseRow>(
      `SELECT id, name, location, temperature_zone AS "temperatureZone",
              capacity_pallets AS "capacityPallets", occupied_pallets AS "occupiedPallets", status
       FROM app.logistics_warehouses ORDER BY name`,
    ),
    qSafe<CustomsRow>(
      `SELECT id, bol_no AS "bolNo", customer, port, to_char(eta, 'YYYY-MM-DD') AS eta, status
       FROM app.logistics_customs ORDER BY eta ASC NULLS LAST, id DESC`,
    ),
  ]);
  return { kpis: kpis ?? null, fleet, shipments, warehouses, customs };
}

export async function saveLogisticsKpis(d: LogisticsKpisRow) {
  await q(
    `INSERT INTO app.logistics_kpis(id, fleet_count, on_route_count, outlets_reached)
     VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       fleet_count = EXCLUDED.fleet_count,
       on_route_count = EXCLUDED.on_route_count,
       outlets_reached = EXCLUDED.outlets_reached,
       updated = now()`,
    [d.fleetCount, d.onRouteCount, d.outletsReached],
  );
}

export async function saveFleetVehicle(d: Omit<FleetVehicleRow, "id">) {
  await q(
    `INSERT INTO app.logistics_fleet(vehicle_no, vehicle_type, driver_name, route, temperature_mode, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (vehicle_no) DO UPDATE SET
       vehicle_type = EXCLUDED.vehicle_type,
       driver_name = EXCLUDED.driver_name,
       route = EXCLUDED.route,
       temperature_mode = EXCLUDED.temperature_mode,
       status = EXCLUDED.status,
       updated = now()`,
    [d.vehicleNo, d.vehicleType, d.driverName, d.route, d.temperatureMode, d.status],
  );
}

export async function deleteFleetVehicle(id: number) {
  await q("DELETE FROM app.logistics_fleet WHERE id = $1", [id]);
}

export async function saveShipment(d: Omit<ShipmentRow, "id">) {
  await q(
    `INSERT INTO app.logistics_shipments(shipment_code, destination, temperature, vehicle, eta, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (shipment_code) DO UPDATE SET
       destination = EXCLUDED.destination,
       temperature = EXCLUDED.temperature,
       vehicle = EXCLUDED.vehicle,
       eta = EXCLUDED.eta,
       status = EXCLUDED.status,
       updated = now()`,
    [d.shipmentCode, d.destination, d.temperature, d.vehicle, d.eta, d.status],
  );
}

export async function deleteShipment(id: number) {
  await q("DELETE FROM app.logistics_shipments WHERE id = $1", [id]);
}

export async function saveWarehouse(d: Omit<WarehouseRow, "id">) {
  await q(
    `INSERT INTO app.logistics_warehouses(name, location, temperature_zone, capacity_pallets, occupied_pallets, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (name) DO UPDATE SET
       location = EXCLUDED.location,
       temperature_zone = EXCLUDED.temperature_zone,
       capacity_pallets = EXCLUDED.capacity_pallets,
       occupied_pallets = EXCLUDED.occupied_pallets,
       status = EXCLUDED.status,
       updated = now()`,
    [d.name, d.location, d.temperatureZone, d.capacityPallets, d.occupiedPallets, d.status],
  );
}

export async function deleteWarehouse(id: number) {
  await q("DELETE FROM app.logistics_warehouses WHERE id = $1", [id]);
}

export async function saveCustomsClearance(d: Omit<CustomsRow, "id">) {
  await q(
    `INSERT INTO app.logistics_customs(bol_no, customer, port, eta, status)
     VALUES ($1, $2, $3, $4::date, $5)
     ON CONFLICT (bol_no) DO UPDATE SET
       customer = EXCLUDED.customer,
       port = EXCLUDED.port,
       eta = EXCLUDED.eta,
       status = EXCLUDED.status,
       updated = now()`,
    [d.bolNo, d.customer, d.port, d.eta, d.status],
  );
}

export async function deleteCustomsClearance(id: number) {
  await q("DELETE FROM app.logistics_customs WHERE id = $1", [id]);
}

