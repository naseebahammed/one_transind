import { q, q1 } from "@/lib/db";

export const listPropertyTypes = async () =>
  (await q<{ key: string; name: string }>("SELECT key, name FROM app.property_types ORDER BY lower(name)")).map((r) => [r.key, r.name] as [string, string]);

export const countCompaniesByPropertyType = async (key: string) =>
  (await q1<{ n: number }>("SELECT COUNT(*)::int AS n FROM app.companies WHERE property_type=$1", [key]))!.n;
