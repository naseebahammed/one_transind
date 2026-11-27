import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, money } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { latestSupplierAgeing } from "@/lib/supplier-ageing-records";
import { Kpi } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Payables · One Transind" };

export default function Page() {
  return <Suspense fallback={<PageSkeleton kpis={3} panels={1} />}><Content /></Suspense>;
}

// The ERP stores what we owe as a negative number, so amounts are flipped here: a positive figure is owed to the supplier, a negative one is an advance paid to them.
async function Content() {
  await connection();
  await requireUser("finance");
  const translate = translator(await getLanguage());
  const { asOf, rows } = await latestSupplierAgeing();
  if (!asOf) return <p className="empty">No supplier ageing uploaded yet. Upload it under Admin, Company finance.</p>;
  const owed = (value: number) => -value;
  const buckets = [
    ["1-30", (r: (typeof rows)[number]) => r.days1To30], ["31-60", (r: (typeof rows)[number]) => r.days31To60], ["61-90", (r: (typeof rows)[number]) => r.days61To90],
    ["91-120", (r: (typeof rows)[number]) => r.days91To120], ["121-180", (r: (typeof rows)[number]) => r.days121To180], ["181-360", (r: (typeof rows)[number]) => r.days181To360],
    ["Above 1 year", (r: (typeof rows)[number]) => r.overOneYear],
  ] as const;
  const totalOwed = rows.filter((r) => r.total < 0).reduce((a, r) => a - r.total, 0);
  const advances = rows.filter((r) => r.total > 0).reduce((a, r) => a + r.total, 0);
  const top = rows.filter((r) => r.total < 0).slice(0, 20); // rows arrive sorted by total, most owed first

  return (
    <>
      <p><Link href="/finance">{translate("‹ Finance")}</Link></p>
      <div className="kpis">
        <Kpi label={translate("Owed to suppliers")} value={`${money(totalOwed)} QAR`} />
        <Kpi label={translate("Advances paid")} value={`${money(advances)} QAR`} />
        <Kpi label={translate("Supplier accounts")} value={fmt(rows.filter((r) => r.total !== 0).length)} />
      </div>
      <p className="note">{translate("As of")} {asOf}</p>
      <section className="panel">
        <header><h2>{translate("By age")}</h2></header>
        <div className="tw scroll"><table>
          <thead><tr>{buckets.map(([name]) => <th key={name}>{name}</th>)}</tr></thead>
          <tbody><tr>{buckets.map(([name, pick]) => <td key={name}>{fmt(owed(rows.reduce((a, r) => a + pick(r), 0)))}</td>)}</tr></tbody>
        </table></div>
      </section>
      <section className="panel">
        <header><h2>{translate("Largest balances")}</h2></header>
        <div className="tw scroll"><table>
          <thead><tr><th>{translate("Supplier")}</th><th>{translate("Owed (QAR)")}</th><th>{translate("Over 1 year")}</th></tr></thead>
          <tbody>{top.map((r) => <tr key={r.accountNo}><td>{r.name}</td><td>{fmt(owed(r.total))}</td><td>{fmt(owed(r.overOneYear))}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
