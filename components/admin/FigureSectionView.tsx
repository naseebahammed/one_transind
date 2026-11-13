import { Trash2 } from "lucide-react";
import { removeFigureMonth, saveFigureCell } from "@/app/admin/companies/figure-actions";
import { StatusBadge } from "@/components/admin/CompanySectionNav";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { EditPnlFigure } from "@/components/admin/EditPnlFigure";
import { UploadFigures } from "@/components/admin/UploadFigures";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { LINES, MONTHS, type FigureSection, type MonthStatus } from "@/lib/company-data";
import { linesOf, listFigures } from "@/lib/company-figures";
import { fmt } from "@/lib/format";

const NOTES: Record<FigureSection, string> = {
  budget: "Approved monthly budget in QAR. Net profit is calculated. Click any cell below to edit.",
  people: "Month-end headcount, joiners and leavers in numbers, and payroll cost in QAR. Click any cell below to edit.",
  expenses: "Total monthly expenses in QAR. Click any cell below to edit.",
};

export async function FigureSectionView({ company, section, year, statuses, branchId }: { company: { id: number; name: string }; section: FigureSection; year: number; statuses: MonthStatus[]; branchId: number | null }) {
  const [figures, groups] = await Promise.all([listFigures(company.id, section, year, branchId), linesOf(section)]);
  const value = (line: string, m: number) => figures.find((f) => f.line === line && f.month === m)?.value;
  const net = (m: number) => (statuses[m] === "Submitted" ? (value("Revenue", m) ?? 0) - (value("Direct cost", m) ?? 0) - (value("Overheads", m) ?? 0) : undefined);
  const accounts = LINES[section].map((line) => ({ main: groups.get(line) ?? "", sub: line, m: MONTHS.map((_, m) => value(line, m)) }));
  const gridId = `fig-${section}-${year}`;
  return (
    <>
      <Card className="gap-2 py-3">
        <CardHeader><CardTitle className="text-sm">Request and upload</CardTitle><CardDescription>{NOTES[section]}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Button asChild variant="outline"><a href={`/api/companies/${company.id}/template?section=${section}&year=${year}`}>Download {year} template</a></Button>
          <UploadFigures companyId={company.id} section={section} year={year} branchId={branchId} />
          <EditPnlFigure gridId={gridId} year={year} months={MONTHS} accounts={accounts} onSave={saveFigureCell.bind(null, section, year, company.id, branchId)} />
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left"><th className="sticky left-0 z-10 min-w-56 bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">{year}</th>{MONTHS.map((m) => <th key={m} className="min-w-24 px-2 py-2 text-right text-xs font-medium text-muted-foreground">{m}</th>)}</tr>
            <tr className="border-b">
              <th className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium">Status</th>
              {statuses.map((s, m) => <td key={m} className="px-2 py-1.5 text-right"><StatusBadge status={s} /></td>)}
            </tr>
          </thead>
          <tbody>
            {LINES[section].map((line) => {
              const mainGroup = groups.get(line) ?? "";
              return (
                <tr key={line} className="border-t hover:bg-muted/30">
                  <td className="sticky left-0 bg-card px-3 py-1.5 font-medium">{line}</td>
                  {MONTHS.map((_, m) => {
                    const v = value(line, m);
                    return (
                      <td key={m} className="px-2 py-1 text-right tabular-nums">
                        <button
                          type="button"
                          data-edit-grid={gridId}
                          data-main={mainGroup}
                          data-sub={line}
                          data-month={m}
                          title={`Click to edit ${line} (${MONTHS[m]} ${year})`}
                          className="inline-flex min-w-14 justify-end rounded-sm px-1.5 py-0.5 tabular-nums transition-colors hover:bg-info-soft hover:text-info-soft-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {v === undefined ? <span className="text-muted-foreground/35">—</span> : fmt(v, 2, 0)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {section === "budget" && (
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="sticky left-0 bg-muted px-3 py-1.5">Net profit</td>
                {MONTHS.map((_, m) => { const v = net(m); return <td key={m} className="px-2 py-1.5 text-right tabular-nums">{v === undefined ? "" : fmt(v, 2, 0)}</td>; })}
              </tr>
            )}
            <tr className="border-t">
              <td className="sticky left-0 bg-card px-3 py-1 text-muted-foreground">Remove month</td>
              {statuses.map((s, m) => (
                <td key={m} className="px-2 py-1 text-right">
                  {s === "Submitted" && (
                    <form action={removeFigureMonth}>
                      <input type="hidden" name="companyId" value={company.id} />
                      <input type="hidden" name="branchId" value={branchId ?? ""} />
                      <input type="hidden" name="section" value={section} />
                      <input type="hidden" name="year" value={year} />
                      <input type="hidden" name="month" value={m} />
                      <ConfirmButton size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Remove ${MONTHS[m]} ${year}`} title="Remove" message={`Remove ${company.name}'s ${MONTHS[m]} ${year} figures? This cannot be undone.`}><Trash2 /></ConfirmButton>
                    </form>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
