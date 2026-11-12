"use client";
import { useState } from "react";
import { fmt } from "@/lib/format";
import type { CustomerOutstanding } from "@/lib/receivables";

const COLUMNS = [["name", "Customer"], ["overdue", "Overdue"], ["oldestOverdueDays", "Oldest overdue (days)"], ["balance", "Total outstanding"]] as const;
type Key = (typeof COLUMNS)[number][0];

/** Click a heading to sort by it; click again to reverse. Starts on the biggest overdue amount. */
export function OutstandingTable({ rows }: { rows: CustomerOutstanding[] }) {
  const [sort, setSort] = useState<{ key: Key; down: boolean }>({ key: "overdue", down: true });
  const [showAll, setShowAll] = useState(false);
  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * (sort.down ? -1 : 1);
  });
  const visible = showAll ? sorted : sorted.slice(0, 10);
  return (
    <>
    <div className="tw"><table>
      <thead><tr>{COLUMNS.map(([key, label]) => (
        <th key={key} className={key === "name" ? undefined : "n"} aria-sort={sort.key === key ? (sort.down ? "descending" : "ascending") : "none"}>
          <button type="button" onClick={() => setSort({ key, down: sort.key === key ? !sort.down : key !== "name" })} style={{ all: "inherit", cursor: "pointer" }}>
            {label}{sort.key === key ? (sort.down ? " ▼" : " ▲") : ""}
          </button>
        </th>
      ))}</tr></thead>
      <tbody>{visible.map((o) => <tr key={o.name}><td>{o.name}</td><td className="n num">{fmt(o.overdue)}</td><td className="n num">{o.oldestOverdueDays || "—"}</td><td className="n num">{fmt(o.balance)}</td></tr>)}</tbody>
    </table></div>
    {!showAll && sorted.length > 10 && <button type="button" className="btn sm" onClick={() => setShowAll(true)} style={{ marginTop: 10 }}>Show all ({fmt(sorted.length)})</button>}
    </>
  );
}
