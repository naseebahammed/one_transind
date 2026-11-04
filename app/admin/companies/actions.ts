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
  const { name, sector, email, phone, active, totalRooms, roomTypes, propertyType, legalName, ownershipPct, started, erpCode, dataOwner } = parsed.data;
  const profile = [legalName, ownershipPct, started, erpCode, dataOwner];
  const logoFile = f.get("logo");
  const logo = logoFile instanceof File && logoFile.size > 0 ? logoFile : null;
  if (logo && !logo.type.startsWith("image/")) return { error: "Logo must be an image file." };
  if (logo && logo.size > 2 * 1024 * 1024) return { error: "Logo must be under 2MB." };
  const logoBuf = logo ? Buffer.from(await logo.arrayBuffer()) : null;
  try {
    if (id) {
      if (logoBuf) await q("UPDATE app.companies SET name=$1, sector=$2, email=$3, phone=$4, active=$5, total_rooms=$6, room_types=$7, property_type=$8, logo=$9, logo_type=$10, legal_name=$11, ownership_pct=$12, started=$13, erp_code=$14, data_owner=$15 WHERE id=$16", [name, sector, email, phone, active, totalRooms, JSON.stringify(roomTypes), propertyType, logoBuf, logo!.type, ...profile, id]);
      else await q("UPDATE app.companies SET name=$1, sector=$2, email=$3, phone=$4, active=$5, total_rooms=$6, room_types=$7, property_type=$8, legal_name=$9, ownership_pct=$10, started=$11, erp_code=$12, data_owner=$13 WHERE id=$14", [name, sector, email, phone, active, totalRooms, JSON.stringify(roomTypes), propertyType, ...profile, id]);
    } else {
      if (logoBuf) await q("INSERT INTO app.companies(name,sector,email,phone,active,total_rooms,room_types,property_type,logo,logo_type,legal_name,ownership_pct,started,erp_code,data_owner) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)", [name, sector, email, phone, active, totalRooms, JSON.stringify(roomTypes), propertyType, logoBuf, logo!.type, ...profile]);
      else await q("INSERT INTO app.companies(name,sector,email,phone,active,total_rooms,room_types,property_type,legal_name,ownership_pct,started,erp_code,data_owner) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)", [name, sector, email, phone, active, totalRooms, JSON.stringify(roomTypes), propertyType, ...profile]);
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "A company with this name already exists." };
    throw e;
  }
  revalidatePath("/admin/companies");
  redirect("/admin/companies");
}

export async function deleteCompany(f: FormData) {
  await q("DELETE FROM app.companies WHERE id=$1", [Number(f.get("id"))]);
  revalidatePath("/admin/companies");
  redirect("/admin/companies");
}

/** Sets whether a company's data is hidden on the finance page ("hidden" = 1 or 0); the company record itself is untouched. Absolute, not a flip, so a double submit is harmless. */
export async function toggleCompanyHidden(f: FormData) {
  const id = Number(f.get("id"));
  if (!id) return;
  await q("UPDATE app.companies SET hidden=$1 WHERE id=$2", [f.get("hidden") === "1" ? 1 : 0, id]);
  revalidatePath("/admin/finance");
}
