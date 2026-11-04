import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { keyFor, plRows, report, years } from "@/lib/al-manzil";
import { listCompanies } from "@/lib/companies";
import { fmt, money, MONTHS, pct, sum } from "@/lib/format";
import { link } from "@/lib/url";
import { CompareChart } from "@/components/charts";
import { CompanySelect } from "@/components/CompanySelect";
import { YearSelect } from "@/components/YearSelect";
import { Change, Kpi, Panel } from "@/components/ui";

type Params = Promise<{ year?: string; company?: string }>;
/** One sector's monthly sales page (Health & Beauty, Retail): sector = admin sector key, path = the page's route. */
type Props = { searchParams: Params; sector: string; path: string; title: string };

export function SectorSales(p: Props) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content {...p} /></Suspense>;
}

// Monthly sales per company, entered under Admin → Finance (sales grid).
const sales = (y: number, key: string | string[]) => report(y, key, plRows(y, key, "sales")).revenue;

async function Content({ searchParams, sector, path, title }: Props) {
  await connection(); // sales files change when figures are edited in admin
  const { year, company } = await searchParams;
  const cos = (await listCompanies("", sector)).filter((c) => c.active && !c.hidden && years(keyFor(c), "sales").length);
  const all = cos.map(keyFor);
  const ys = years(all, "sales");
  if (!ys.length) return <p className="empty">No sales entered for any {title} company yet.</p>;
  const sel = cos.find((c) => String(c.id) === company); // undefined = all companies
  const keys = sel ? keyFor(sel) : all;
  const cur = year && ys.includes(+year) ? +year : ys[ys.length - 1];
  const grand = sales(cur, all);
  // Compare against the same months last year: the current year is usually only partly loaded.
  const upto = Math.max(1, ...grand.map((v, i) => (v ? i + 1 : 0)));
  const period = upto < 12 ? `Jan–${MONTHS[upto - 1]}` : "full year";
  const ytd = (a: number[]) => sum(a.slice(0, upto));
  const total = sel ? sales(cur, keys) : grand;
  const prev = ys.includes(cur - 1) ? sales(cur - 1, keys) : null;
  const best = total.indexOf(Math.max(...total));
  const shown = ys.filter((y) => y <= cur).slice(-3);
  const per = cos.map((c) => ({ c, s: ytd(sales(cur, keyFor(c))), p: ytd(sales(cur - 1, keyFor(c))) })).sort((a, b) => b.s - a.s);
  const grandYtd = ytd(grand);
  const diff = prev ? ytd(total) - ytd(prev) : 0;
  // Gross profit only when every company in view has a COGS line in its P&L (Top Perfume does; Pavati reports sales only).
  const cogsOf = (k: string | string[]) => plRows(cur, k).filter((x) => x.main === "COGS");
  const cogs = (sel ? [sel] : cos).every((c) => cogsOf(keyFor(c)).length) ? -sum(cogsOf(keys).map((x) => ytd(x.m))) : null; // costs are stored negative
  const filled = total.slice(0, upto).filter(Boolean).length || 1; // months with sales entered, not empty gaps

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginInlineEnd: "auto" }}>{sel?.name ?? title} sales · {cur}</h2>
        {cos.length > 1 && <CompanySelect companies={cos} value={sel?.id ?? "all"} allLabel="All companies" base={link(path, { year })} />}
        <YearSelect years={ys} value={cur} base={link(path, { company: sel && String(sel.id) })} />
      </div>
      <div className="kpis">
        <Kpi label={`Sales ${cur} (${period})`} value={money(ytd(total))} delta={prev ? <>{diff >= 0 ? "+" : "-"}{money(Math.abs(diff))} <Change pct={pct(ytd(total), ytd(prev))} /></> : undefined} spark={total.slice(0, upto).map((v) => v / 1e6)} up={!prev || ytd(total) >= ytd(prev)} />
        <Kpi label={`Same period ${cur - 1}`} value={prev ? money(ytd(prev)) : "—"} />
        <Kpi label="Monthly average" value={money(ytd(total) / filled)} delta={`${filled} month${filled > 1 ? "s" : ""} with sales`} />
        <Kpi label="Best month" value={total[best] ? MONTHS[best] : "—"} delta={total[best] ? money(total[best]) : undefined} />
        {cogs !== null && <Kpi label={`Gross profit (${period})`} value={money(ytd(total) - cogs)} delta={`${fmt(ytd(total) ? ((ytd(total) - cogs) / ytd(total)) * 100 : 0, 1)}% margin · COGS ${money(cogs)}`} />}
      </div>
      <div className="grid">
        <Panel span={12} title="Sales by month">
          <CompareChart years={shown} series={shown.map((y) => sales(y, keys).map((v) => v / 1e6 || null))} sel={upto - 1} />
        </Panel>
        <Panel span={12} title={`Monthly figures ${cur} vs ${cur - 1}`}>
          <div className="tw"><table>
            <thead><tr><th>Month</th><th className="n">{cur}</th><th className="n">{cur - 1}</th><th className="n">Difference</th><th className="n">Change</th></tr></thead>
            <tbody>{MONTHS.map((m, i) => {
              const a = total[i], b = prev?.[i] ?? 0;
              return (
                <tr key={m}>
                  <td>{m}</td>
                  <td className="n num">{a ? fmt(a) : "—"}</td>
                  <td className="n num">{b ? fmt(b) : "—"}</td>
                  <td className="n num">{a && b ? `${a >= b ? "+" : "-"}${fmt(Math.abs(a - b))}` : "—"}</td>
                  <td className="n">{a && b ? <Change pct={pct(a, b)} /> : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </Panel>
        <Panel span={12} title={`Companies (${period} ${cur})`}>
          <div className="tw"><table>
            <thead><tr><th>Company</th><th className="n">{cur}</th><th className="n">{cur - 1} same period</th><th className="n">Change</th><th style={{ width: "30%" }}>Share of sales</th></tr></thead>
            <tbody>{per.map((x) => {
              const share = grandYtd ? (x.s / grandYtd) * 100 : 0;
              return (
                <tr key={x.c.id}>
                  <td><Link href={link(path, { year, company: sel?.id === x.c.id ? undefined : String(x.c.id) })} style={{ fontWeight: sel?.id === x.c.id ? 700 : undefined }}>{x.c.name}</Link></td>
                  <td className="n num">{fmt(x.s)}</td>
                  <td className="n num">{x.p ? fmt(x.p) : "—"}</td>
                  <td className="n">{x.p ? <Change pct={pct(x.s, x.p)} /> : "—"}</td>
                  <td><div className="hbar" style={{ gridTemplateColumns: "1fr 48px" }}><span className="track"><span className="fill" style={{ display: "block", width: `${Math.max(1, share)}%` }} /></span><span className="num">{fmt(share, 1)}%</span></div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
