import { q, q1 } from "@/lib/db";
import { type RoomType } from "@/lib/companies.shared";
import { type CompanyInput } from "@/lib/company-input";

export type Company = { id: number; name: string; sector: string; active: number; total_rooms: number; room_types: RoomType[]; hidden: number; property_type: string; has_logo: boolean; erp_code: string; has_branches: number };

// Excludes the logo bytes themselves - listing/editing a company shouldn't pull its image blob along.
const COLS = "id,name,sector,active,total_rooms,room_types,hidden,property_type,(logo IS NOT NULL) AS has_logo,erp_code,has_branches";

export const listCompanies = (query = "", sector = "") =>
  q<Company>(`SELECT ${COLS} FROM app.companies WHERE name ILIKE $1 AND ($2::text='' OR sector=$2) ORDER BY lower(name)`, [`%${query}%`, sector]);

export const getCompany = (id: number) => q1<Company>(`SELECT ${COLS} FROM app.companies WHERE id=$1`, [id]);

export const listCompanyIds = () => q<{ id: number }>(`SELECT id FROM app.companies ORDER BY lower(name)`);

export const getCompanyLogo = (id: number) => q1<{ logo: Buffer; logo_type: string }>("SELECT logo, logo_type FROM app.companies WHERE id=$1", [id]);

export async function saveCompanyRecord(id: number, data: CompanyInput, logo: { buf: Buffer; type: string } | null): Promise<{ error?: string }> {
  const { name, sector, active, totalRooms, roomTypes, propertyType, erpCode } = data;
  try {
    if (id) {
      if (logo) await q("UPDATE app.companies SET name=$1, sector=$2, active=$3, total_rooms=$4, room_types=$5, property_type=$6, logo=$7, logo_type=$8, erp_code=$9 WHERE id=$10", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, logo.buf, logo.type, erpCode, id]);
      else await q("UPDATE app.companies SET name=$1, sector=$2, active=$3, total_rooms=$4, room_types=$5, property_type=$6, erp_code=$7 WHERE id=$8", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, erpCode, id]);
    } else {
      if (logo) await q("INSERT INTO app.companies(name,sector,active,total_rooms,room_types,property_type,logo,logo_type,erp_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, logo.buf, logo.type, erpCode]);
      else await q("INSERT INTO app.companies(name,sector,active,total_rooms,room_types,property_type,erp_code) VALUES($1,$2,$3,$4,$5,$6,$7)", [name, sector, active, totalRooms, JSON.stringify(roomTypes), propertyType, erpCode]);
    }
    return {};
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "A company with this name already exists." };
    throw e;
  }
}

export const setCompanyHidden = (id: number, hidden: number) =>
  q("UPDATE app.companies SET hidden=$1 WHERE id=$2", [hidden, id]);
