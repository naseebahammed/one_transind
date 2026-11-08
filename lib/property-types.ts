import { q, q1 } from "@/lib/db";

export const listPropertyTypes = async () =>
  (await q<{ key: string; name: string }>("SELECT key, name FROM app.property_types ORDER BY lower(name)")).map((r) => [r.key, r.name] as [string, string]);

export const countCompaniesByPropertyType = async (key: string) =>
  (await q1<{ n: number }>("SELECT COUNT(*)::int AS n FROM app.companies WHERE property_type=$1", [key]))!.n;

export async function createPropertyType(name: string): Promise<{ error?: string }> {
  if (await q1("SELECT 1 FROM app.property_types WHERE lower(name)=lower($1)", [name])) return { error: "A company type with this name already exists." };
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "type";
  let key = base;
  for (let i = 2; await q1("SELECT 1 FROM app.property_types WHERE key=$1", [key]); i++) key = `${base}-${i}`;
  await q("INSERT INTO app.property_types(key,name) VALUES($1,$2)", [key, name]);
  return {};
}

export async function renamePropertyTypeByKey(key: string, name: string) {
  if (name && !(await q1("SELECT 1 FROM app.property_types WHERE lower(name)=lower($1) AND key<>$2", [name, key])))
    await q("UPDATE app.property_types SET name=$1 WHERE key=$2", [name, key]);
}

export async function removePropertyType(key: string) {
  if (await countCompaniesByPropertyType(key)) return; // UI disables the button; this guards a forged request
  await q("DELETE FROM app.property_types WHERE key=$1", [key]);
}
