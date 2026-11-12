// Combines Step 1 live ERP Trading receivables with Step 2 monthly subsidiary receivables snapshots without double-counting Trading.
import { roundMoney, sumMoney } from "./money.ts";
import { SECTOR } from "./org.ts";

export type CombinedOverdueInvoice = {
  key: string;
  invoiceNo: string;
  accountName: string;
  companyName: string | null;
  dueDate: string;
  amount: number;
  balance: number;
  status: string;
};

export type CombinedReceivables = {
  latestAsOf: string;
  sourceLabel: string;
  erpConnected: boolean;
  subsidiaryCount: number;
  dsoDays: number | null;
  notDue: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
  overdueInvoices: CombinedOverdueInvoice[];
};

export type ErpReceivablesInput = {
  connected: boolean;
  asOf: string;
  notDue: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
  overdueInvoices: {
    invoiceNo: string;
    accountName: string;
    dueDate: string;
    amount: number;
    balance: number;
    daysOverdue: number;
    status: string;
  }[];
};

export type SnapshotReceivablesInput = {
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

export type ManualOverdueInput = {
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

export function computeElapsedYearDays(year: number, monthIndex: number, dayOfMonth: number): number {
  const startUtc = Date.UTC(year, 0, 1);
  const endUtc = Date.UTC(year, monthIndex, Math.max(1, dayOfMonth));
  return Math.max(1, Math.floor((endUtc - startUtc) / 86_400_000) + 1);
}

export function computeErpDsoDays(openReceivables: number, ytdSales: number, elapsedDays: number): number | null {
  if (!Number.isFinite(openReceivables) || openReceivables < 0) return null;
  if (!Number.isFinite(ytdSales) || ytdSales <= 0) return null;
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) return null;
  return Math.round(((openReceivables / ytdSales) * elapsedDays) * 10) / 10;
}

export function combineReceivablesRollup(params: {
  erp: ErpReceivablesInput;
  erpDsoDays: number | null;
  snapshots: SnapshotReceivablesInput[];
  manualOverdue: ManualOverdueInput[];
  tradingCompanyIds: Set<number>;
  overdueLimit?: number;
}): CombinedReceivables | null {
  const { erp, erpDsoDays, snapshots, manualOverdue, tradingCompanyIds, overdueLimit = 25 } = params;

  // When live ERP Trading receivables are connected, skip any snapshot bound to a Trading company so Trading AR is never counted twice.
  const includedSnapshots = erp.connected
    ? snapshots.filter((row) => row.companyId === null || !tradingCompanyIds.has(row.companyId))
    : snapshots;

  if (!erp.connected && includedSnapshots.length === 0) {
    return null;
  }

  const notDue = sumMoney([erp.connected ? erp.notDue : 0, ...includedSnapshots.map((r) => r.notDue)]);
  const days1To30 = sumMoney([erp.connected ? erp.days1To30 : 0, ...includedSnapshots.map((r) => r.days1To30)]);
  const days31To60 = sumMoney([erp.connected ? erp.days31To60 : 0, ...includedSnapshots.map((r) => r.days31To60)]);
  const days61To90 = sumMoney([erp.connected ? erp.days61To90 : 0, ...includedSnapshots.map((r) => r.days61To90)]);
  const over90 = sumMoney([erp.connected ? erp.over90 : 0, ...includedSnapshots.map((r) => r.over90)]);
  const total = sumMoney([erp.connected ? erp.total : 0, ...includedSnapshots.map((r) => r.total)]);

  const dates = [
    ...(erp.connected ? [erp.asOf] : []),
    ...includedSnapshots.map((r) => r.asOf),
  ].filter(Boolean);
  const latestAsOf = dates.sort().at(-1) ?? erp.asOf;

  const dsoContributors: { weight: number; dso: number }[] = [];
  if (erp.connected && erpDsoDays !== null) {
    dsoContributors.push({ weight: Math.max(0, erp.total), dso: erpDsoDays });
  }
  for (const snap of includedSnapshots) {
    if (snap.dsoDays !== null) {
      dsoContributors.push({ weight: Math.max(0, snap.total), dso: snap.dsoDays });
    }
  }

  let dsoDays: number | null = null;
  if (dsoContributors.length > 0) {
    const totalWeight = sumMoney(dsoContributors.map((c) => c.weight));
    const weighted =
      totalWeight > 0
        ? sumMoney(dsoContributors.map((c) => c.weight * c.dso)) / totalWeight
        : sumMoney(dsoContributors.map((c) => c.dso)) / dsoContributors.length;
    dsoDays = Math.round(weighted * 10) / 10;
  }

  const subsidiaryCount = includedSnapshots.filter((r) => r.companyId !== null).length;
  let sourceLabel: string;
  if (erp.connected) {
    if (subsidiaryCount > 0) {
      sourceLabel = `ERP Trading + ${subsidiaryCount} ${subsidiaryCount === 1 ? "subsidiary" : "subsidiaries"}`;
    } else if (includedSnapshots.length > 0) {
      sourceLabel = "ERP Trading + manual adjustments";
    } else {
      sourceLabel = "ERP Trading receivables";
    }
  } else {
    sourceLabel = `As of ${latestAsOf}`;
  }

  const byInvoice = new Map<string, CombinedOverdueInvoice>();
  for (const inv of manualOverdue) {
    const norm = inv.invoiceNo.trim().toLowerCase();
    if (!norm) continue;
    byInvoice.set(norm, {
      key: `manual-${inv.id}`,
      invoiceNo: inv.invoiceNo,
      accountName: inv.accountName,
      companyName: inv.companyName,
      dueDate: inv.dueDate,
      amount: roundMoney(inv.amount),
      balance: roundMoney(inv.balance),
      status: inv.status,
    });
  }
  if (erp.connected) {
    for (const inv of erp.overdueInvoices) {
      const norm = inv.invoiceNo.trim().toLowerCase();
      if (!norm || byInvoice.has(norm)) continue;
      byInvoice.set(norm, {
        key: `erp-${inv.invoiceNo}`,
        invoiceNo: inv.invoiceNo,
        accountName: inv.accountName,
        companyName: "Transind Trading",
        dueDate: inv.dueDate,
        amount: roundMoney(inv.amount),
        balance: roundMoney(inv.balance),
        status: inv.status,
      });
    }
  }

  const overdueInvoices = [...byInvoice.values()]
    .sort((a, b) => b.balance - a.balance || a.dueDate.localeCompare(b.dueDate))
    .slice(0, overdueLimit);

  return {
    latestAsOf,
    sourceLabel,
    erpConnected: erp.connected,
    subsidiaryCount,
    dsoDays,
    notDue,
    days1To30,
    days31To60,
    days61To90,
    over90,
    total,
    overdueInvoices,
  };
}

const loadDeps = async () => {
  const [receivablesMod, manualMod, companiesMod] = await Promise.all([
    import("@/lib/receivables"),
    import("@/lib/manual-report-records"),
    import("@/lib/companies"),
  ]);
  return { receivablesMod, manualMod, companiesMod };
};

export async function getCombinedReceivables(options?: {
  ytdErpSales?: number;
  year?: number;
  month?: number;
  day?: number;
  overdueLimit?: number;
}): Promise<CombinedReceivables | null> {
  const { receivablesMod, manualMod, companiesMod } = await loadDeps();
  const limit = options?.overdueLimit ?? 25;
  const [erp, snapshots, manualOverdue, companies] = await Promise.all([
    receivablesMod.getGroupErpReceivables(limit),
    manualMod.listReceivablesSnapshots(),
    manualMod.listOverdueInvoices(),
    companiesMod.listCompanies(),
  ]);

  const tradingCompanyIds = new Set(
    companies.filter((c) => c.sector === SECTOR.trading).map((c) => c.id),
  );

  const erpDsoDays =
    erp.connected &&
    options?.ytdErpSales !== undefined &&
    options.year !== undefined &&
    options.month !== undefined &&
    options.day !== undefined
      ? computeErpDsoDays(
          erp.total,
          options.ytdErpSales,
          computeElapsedYearDays(options.year, options.month, options.day),
        )
      : null;

  return combineReceivablesRollup({
    erp,
    erpDsoDays,
    snapshots,
    manualOverdue,
    tradingCompanyIds,
    overdueLimit: limit,
  });
}

export async function getCompanyReceivablesSnapshot(companyId: number): Promise<SnapshotReceivablesInput | null> {
  const { manualMod } = await loadDeps();
  const snapshots = await manualMod.listReceivablesSnapshots();
  return snapshots.find((s) => s.companyId === companyId) ?? null;
}
