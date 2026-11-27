import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, money } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { bankPositionKind } from "@/lib/bank-position";
import { latestBankPosition } from "@/lib/bank-position-records";
import { Kpi } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Bank position · One Transind" };

export default function Page() {
  return <Suspense fallback={<PageSkeleton kpis={4} panels={2} />}><Content /></Suspense>;
}

// Amounts keep the sheet's sign: a negative figure is owed to the bank. The screen shows owed amounts as positive numbers in their own columns.
async function Content() {
  await connection();
  await requireUser("finance");
  const translate = translator(await getLanguage());
  const { asOf, rows } = await latestBankPosition();
  if (!asOf) return <p className="empty">No bank position uploaded yet. Upload it under Admin, Company finance.</p>;

  const total = (kind: ReturnType<typeof bankPositionKind>, items = rows) => items.filter((r) => bankPositionKind(r) === kind).reduce((sum, r) => sum + r.used, 0);
  const room = rows.filter((r) => bankPositionKind(r) === "borrowing" && (r.available ?? 0) > 0).reduce((sum, r) => sum + (r.available ?? 0), 0);
  const banks = [...new Set(rows.map((r) => r.bank))];

  return (
    <>
      <p><Link href="/finance">{translate("‹ Finance")}</Link></p>
      <div className="kpis">
        <Kpi label={translate("Cash at bank")} value={`${money(total("cash"))} QAR`} />
        <Kpi label={translate("Borrowing")} value={`${money(-total("borrowing"))} QAR`} />
        <Kpi label={translate("Guarantees and letters of credit")} value={`${money(-total("guarantee"))} QAR`} />
        <Kpi label={translate("Unused borrowing room")} value={`${money(room)} QAR`} />
      </div>
      <p className="note">{translate("As of")} {asOf}</p>
      <section className="panel">
        <header><h2>{translate("By bank")}</h2></header>
        <div className="tw scroll"><table>
          <thead><tr><th>{translate("Bank")}</th><th>{translate("Cash at bank")}</th><th>{translate("Borrowing")}</th><th>{translate("Guarantees and letters of credit")}</th></tr></thead>
          <tbody>{banks.map((bank) => { const mine = rows.filter((r) => r.bank === bank); return <tr key={bank}><td>{bank}</td><td>{fmt(total("cash", mine))}</td><td>{fmt(-total("borrowing", mine))}</td><td>{fmt(-total("guarantee", mine))}</td></tr>; })}</tbody>
        </table></div>
      </section>
      {banks.map((bank) => {
        const accounts = [...new Set(rows.filter((r) => r.bank === bank).map((r) => r.account))];
        return (
          <section key={bank} className="panel">
            <header><h2>{bank}</h2></header>
            <div className="tw scroll"><table>
              <thead><tr><th>{translate("Account")}</th><th>{translate("Facility")}</th><th>{translate("Limit")}</th><th>{translate("Rate")}</th><th>{translate("Balance")}</th><th>{translate("Available")}</th></tr></thead>
              <tbody>{accounts.flatMap((account) => rows.filter((r) => r.bank === bank && r.account === account).map((r, i) => (
                <tr key={`${account}-${r.facility}-${i}`}><td>{i === 0 ? account : ""}</td><td>{r.facility}</td><td>{r.creditLimit === null ? "—" : fmt(r.creditLimit)}</td>
                  <td>{r.rate === null ? "—" : `${fmt(r.rate * 100, 2)}%`}</td><td>{fmt(r.used)}</td><td>{r.available === null ? "—" : fmt(r.available)}</td></tr>
              )))}</tbody>
            </table></div>
          </section>
        );
      })}
    </>
  );
}
