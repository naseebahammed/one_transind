"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { parseCompany } from "@/lib/company-input";
import { listSectors } from "@/lib/sectors";
import { listPropertyTypes } from "@/lib/property-types";

export type FormState = { error?: string };

export async function saveCompany(_: FormState, f: FormData): Promise<FormState> {
  const id = Number(f.get("id")) || 0;
  const [sectors, propertyTypes] = await Promise.all([listSectors(), listPropertyTypes()]);
  const parsed = parseCompany(f, sectors.map(([k]) => k), propertyTypes.map(([k]) => k));
  if ("error" in parsed) return parsed;
  const { name, sector, active, totalRooms, roomTypes, propertyType, erpCode } = parsed.data;
  const logoFile = f.get("logo");
  const logo = logoFile instanceof File && logoFile.size > 0 ? logoFile : null;
  if (logo && !logo.type.startsWith("image/")) return { error: "Logo must be an image file." };
  if (logo && logo.size > 2 * 1024 * 1024) return { error: "Logo must be under 2MB." };
  const logoBuf = logo ? Buffer.from(await logo.arrayBuffer()) : null;
  try {
    if (id) {
      if (logoBuf) await q("UPDATE app.companies SET name=$1, sector=$2, active=$3, total_rooms=$4, room_types=$5, property_type=$6, logo=$7, logo_type=$8, erp_code=$9 WHERE id=$10", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, logoBuf, logo!.type, erpCode, id]);
      else await q("UPDATE app.companies SET name=$1, sector=$2, active=$3, total_rooms=$4, room_types=$5, property_type=$6, erp_code=$7 WHERE id=$8", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, erpCode, id]);
    } else {
      if (logoBuf) await q("INSERT INTO app.companies(name,sector,active,total_rooms,room_types,property_type,logo,logo_type,erp_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, logoBuf, logo!.type, erpCode]);
      else await q("INSERT INTO app.companies(name,sector,active,total_rooms,room_types,property_type,erp_code) VALUES($1,$2,$3,$4,$5,$6,$7)", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, erpCode]);
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "A company with this name already exists." };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/admin/companies");
}

/** Sets whether a company's data is hidden on the finance page ("hidden" = 1 or 0); the company record itself is untouched. Absolute, not a flip, so a double submit is harmless. */
export async function toggleCompanyHidden(f: FormData) {
  const id = Number(f.get("id"));
  if (!id) return;
  await q("UPDATE app.companies SET hidden=$1 WHERE id=$2", [f.get("hidden") === "1" ? 1 : 0, id]);
  revalidatePath("/", "layout");
}
