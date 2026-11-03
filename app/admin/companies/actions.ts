"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { parseCompany } from "@/lib/company-input";
import { listSectors } from "@/lib/sectors";

export type FormState = { error?: string };

export async function saveCompany(_: FormState, f: FormData): Promise<FormState> {
  const id = Number(f.get("id")) || 0;
  const parsed = parseCompany(f, (await listSectors()).map(([k]) => k));
  if ("error" in parsed) return parsed;
  const { name, sector, email, phone, active, totalRooms, roomTypes } = parsed.data;
  try {
    if (id) await q("UPDATE app.companies SET name=$1, sector=$2, email=$3, phone=$4, active=$5, total_rooms=$6, room_types=$7 WHERE id=$8", [name, sector, email, phone, active, totalRooms, JSON.stringify(roomTypes), id]);
    else await q("INSERT INTO app.companies(name,sector,email,phone,active,total_rooms,room_types) VALUES($1,$2,$3,$4,$5,$6,$7)", [name, sector, email, phone, active, totalRooms, JSON.stringify(roomTypes)]);
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
