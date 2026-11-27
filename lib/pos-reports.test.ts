import assert from "node:assert/strict";
import test from "node:test";
import { parsePosReport } from "./pos-reports.ts";

const title = (name: string, month = "01-Oct-2026 31-Oct-2026") => [["DUKAN FOODS"], [`${name} \n DATE : from ${month} ; \n`]];

test("pos: Dukan daily register - company, month and rows come from the sheet, tenders are the columns after User Name", () => {
  const r = parsePosReport([...title("Sales and SR Register - Tenderwise V.1"), [null, "S.No", "Date", "Transaction Type", "Total Qty", "Bill Amount", "User Name", "Cash", "Credit Card"],
    [null, 1, 46296, "Sales", 5, 100.5, "UMESH", 60, 40.5], [null, 2, "02-Oct-2026", "Sales return", -1, -10, "UMESH", -10, 0], [null, " ", null, null, 4, 90.5, null, 50, 40.5]]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual([r.entity, r.kind, r.period], ["DUKAN FOODS", "daily_sales", "2026-10-01"]);
  assert.deepEqual(r.rows.map((x) => [x.saleDate, x.tranType, x.billAmount, x.tenders]), [["2026-10-01", "Sales", 100.5, { Cash: 60, "Credit Card": 40.5 }], ["2026-10-02", "Sales return", -10, { Cash: -10 }]]);
});

test("pos: a report whose rows do not add up to its own total, or that spans two months, is refused", () => {
  const rows = [[null, "S.No", "Date", "Transaction Type", "Total Qty", "Bill Amount"], [null, 1, 46296, "Sales", 5, 100], [null, " ", null, null, 5, 500]];
  assert.match(parsePosReport([...title("Sales and SR Register - Tenderwise V.1"), ...rows]).errors[0], /add up to 100 but the report's own total says 500/);
  assert.match(parsePosReport([...title("Sales and SR Register - Tenderwise V.1", "01-Oct-2026 05-Nov-2026"), ...rows]).errors[0], /more than one calendar month/);
  assert.match(parsePosReport([["x"]]).errors[0], /Not a recognised/);
});

test("pos: the older purchase layout has no S.No and shows the total as its first data row", () => {
  const r = parsePosReport([["Dukhan,,GSTNO:1"], ["DUKAN FOODS"], ["Purchase - Invoice Wise Detailed V.1 \n DATE : from 01-Aug-2025 31-Aug-2025 ; \n"],
    ["Supplier Name", "Gross Amount", "Total Received Qty", "Bill Amount", "Bill No", "Payment Type", "Purchase Date"],
    [null, 100, 5, 100], ["BALADNA", 60, 3, 60, "A1", "CASH", 45870], ["QBAKE", 40, 2, 40, "A2", "CREDIT", 45871]]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows.map((x) => [x.supplier, x.netAmount, x.purchaseDate]), [["BALADNA", 60, "2025-08-01"], ["QBAKE", 40, "2025-08-02"]]);
});

test("pos: Top Perfumes item sales keep the location and cost but not the customer's name or mobile number", () => {
  const r = parsePosReport([["TOP PERFUMES AL WAKRA"], ["Customer - Bill - Itemwise Margin Detail[COFO] \n DATE : from 01-Oct-2026 31-Oct-2026 ; \n"],
    [null, "S.No", "LocationName", "Bill No.", "Bill Date", "Customer Name", "Mobile number & SMS alerts", "Item Code", "Item Name", "Qty", "Net Sales Less Disc", "Net Cost (Without Tax)"],
    [null, 1, "AL NASR", "WL1", 46296, "Jane", "5550100", 1061, "Blush", 1, 328, 152.36], [null, " ", null, null, null, null, null, null, null, 1, 328, 152.36]]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows[0], { location: "AL NASR", billNo: "WL1", billDate: "2026-10-01", itemCode: "1061", itemName: "Blush", qty: 1, freeQty: null, sales: 328, discount: null, cost: 152.36, distributor: null });
});
