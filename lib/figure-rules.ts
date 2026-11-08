// The readers add a company's rows together, so one month must not be entered in two ways or it counts twice.
// A clash refuses the save, with the message returned here: only a person can tell which of the two numbers is right.
import { SECTOR } from "./org.ts";

type Client = { query: (text: string, params: unknown[]) => Promise<{ rows: { month: string }[] }> };

const firstMonth = async (client: Client, text: string, params: unknown[]) => (await client.query(text, params)).rows[0]?.month ?? null;

/** A month of a section is entered per branch or for the whole company, never both. branchId null = the whole company. */
export async function branchClash(client: Client, companyId: number, section: string, periods: string[], branchId: number | null) {
  const month = await firstMonth(client,
    "SELECT to_char(period,'Mon YYYY') AS month FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period = ANY($3::date[]) AND (branch_id IS NULL) <> $4::boolean ORDER BY period LIMIT 1",
    [companyId, section, periods, branchId === null]);
  if (!month) return null;
  return branchId === null
    ? `${month} is already entered per branch, so a whole-company figure would count twice. Remove that month from each branch first, or enter it per branch.`
    : `${month} is already entered for the whole company, so a branch figure would count twice. Remove that month from the whole-company view first, or enter it there.`;
}

/** A retail company's monthly sales are added up from its daily takings, so a month with takings cannot also take a monthly sales figure. */
export async function monthlySalesClash(client: Client, companyId: number, periods: string[]) {
  const month = await firstMonth(client,
    `SELECT to_char(p.m,'Mon YYYY') AS month FROM unnest($2::date[]) AS p(m) JOIN app.companies c ON c.id=$1 AND c.sector=$3
     WHERE EXISTS (SELECT 1 FROM app.daily_receipts r WHERE r.company_id=$1 AND r.date >= p.m AND r.date < (p.m + interval '1 month')::date) ORDER BY p.m LIMIT 1`,
    [companyId, periods, SECTOR.retail]);
  return month ? `${month} already has daily takings, and monthly sales are added up from them. Correct the daily file instead, so the month does not count twice.` : null;
}

/** The same rule from the other side: daily takings cannot be loaded for a retail month that already has a monthly sales figure. */
export async function takingsClash(client: Client, companyId: number, periods: string[]) {
  const month = await firstMonth(client,
    `SELECT to_char(f.period,'Mon YYYY') AS month FROM app.company_figures f JOIN app.companies c ON c.id=f.company_id
     WHERE f.company_id=$1 AND f.section='sales' AND f.period = ANY($2::date[]) AND c.sector=$3 ORDER BY f.period LIMIT 1`,
    [companyId, periods, SECTOR.retail]);
  return month ? `${month} already has a monthly sales figure, so daily takings would count twice. Delete that year's monthly sales on the Finance admin page first.` : null;
}
