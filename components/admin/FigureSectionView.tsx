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
  balance: "Month-end balances in QAR. Assets must equal liabilities plus equity. Every line is needed for a month to count as submitted.",
  budget: "Approved monthly budget in QAR. Net profit is calculated.",
  people: "Month-end headcount, joiners and leavers in numbers, and payroll cost in QAR.",
  expenses: "Total monthly expenses in QAR.",
};

export async function FigureSectionView({ company, section, year, statuses }: { company: { id: number; name: string }; section: FigureSection; year: number; statuses: MonthStatus[] }) {
  const [figures, groups] = await Promise.all([listFigures(company.id, section, year), linesOf(section)]);
  const value = (line: string, m: number) => figures.find((f) => f.line === line && f.month === m)?.value;
  const net = (m: number) => (statuses[m] === "Submitted" ? (value("Revenue", m) ?? 0) - (value("Direct cost", m) ?? 0) - (value("Overheads", m) ?? 0) : undefined);
  const accounts = LINES[section].map((line) => ({ main: groups.get(line) ?? "", sub: line, m: MONTHS.map((_, m) => value(line, m)) }));
  return (
    <>
      <Card className="gap-2 py-3">
        <CardHeader><CardTitle className="text-sm">Request and upload</CardTitle><CardDescription>{NOTES[section]}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Button asChild variant="outline"><a href={`/api/companies/${company.id}/template?section=${section}&year=${year}`}>Download {year} template</a></Button>
          <UploadFigures companyId={company.id} section={section} year={year} />
          <EditPnlFigure year={year} months={MONTHS} accounts={accounts} onSave={saveFigureCell.bind(null, section, year, company.id)} />
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left"><th className="sticky left-0 z-10 min-w-56 bg-muted px-2 py-2">{year}</th>{MONTHS.map((m) => <th key={m} className="min-w-24 px-2 py-2 text-right">{m}</th>)}</tr>
            <tr className="border-b">
              <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left font-medium">Status</th>
              {statuses.map((s, m) => <td key={m} className="px-2 py-1.5 text-right"><StatusBadge status={s} /></td>)}
            </tr>
          </thead>
          <tbody>
            {LINES[section].map((line) => (
              <tr key={line} className="border-t">
                <td className="sticky left-0 bg-card px-2 py-1">{line}</td>
                {MONTHS.map((_, m) => { const v = value(line, m); return <td key={m} className="px-2 py-1 text-right tabular-nums">{v === undefined ? "" : fmt(v, 2, 0)}</td>; })}
              </tr>
            ))}
            {section === "budget" && (
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="sticky left-0 bg-muted px-2 py-1.5">Net profit</td>
                {MONTHS.map((_, m) => { const v = net(m); return <td key={m} className="px-2 py-1.5 text-right tabular-nums">{v === undefined ? "" : fmt(v, 2, 0)}</td>; })}
              </tr>
            )}
            <tr className="border-t">
              <td className="sticky left-0 bg-card px-2 py-1 text-muted-foreground">Remove month</td>
              {statuses.map((s, m) => (
                <td key={m} className="px-2 py-1 text-right">
                  {s === "Submitted" && (
                    <form action={removeFigureMonth}>
                      <input type="hidden" name="companyId" value={company.id} />
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
