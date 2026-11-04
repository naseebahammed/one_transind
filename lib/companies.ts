import { q, q1 } from "@/lib/db";
import { type RoomType } from "@/lib/companies.shared";

export type Company = { id: number; name: string; sector: string; email: string; phone: string; active: number; total_rooms: number; room_types: RoomType[]; hidden: number; property_type: string; has_logo: boolean; legal_name: string; ownership_pct: number | null; started: string; erp_code: string; data_owner: string };

// Excludes the logo bytes themselves - listing/editing a company shouldn't pull its image blob along.
const COLS = "id,name,sector,email,phone,active,total_rooms,room_types,hidden,property_type,(logo IS NOT NULL) AS has_logo,legal_name,ownership_pct::float8 AS ownership_pct,started,erp_code,data_owner";

export const listCompanies = (query = "", sector = "") =>
  q<Company>(`SELECT ${COLS} FROM app.companies WHERE name ILIKE $1 AND ($2::text='' OR sector=$2) ORDER BY lower(name)`, [`%${query}%`, sector]);

export const getCompany = (id: number) => q1<Company>(`SELECT ${COLS} FROM app.companies WHERE id=$1`, [id]);

export const listCompanyIds = () => q<{ id: number }>(`SELECT id FROM app.companies ORDER BY lower(name)`);

export const getCompanyLogo = (id: number) => q1<{ logo: Buffer; logo_type: string }>("SELECT logo, logo_type FROM app.companies WHERE id=$1", [id]);
