import { q, q1 } from "@/lib/db";
import { type RoomType } from "@/lib/companies.shared";

export type Company = { id: number; name: string; sector: string; email: string; phone: string; active: number; total_rooms: number; room_types: RoomType[] };

export const listCompanies = (query = "", sector = "") =>
  q<Company>("SELECT * FROM app.companies WHERE name ILIKE $1 AND ($2::text='' OR sector=$2) ORDER BY lower(name)", [`%${query}%`, sector]);

export const getCompany = (id: number) => q1<Company>("SELECT * FROM app.companies WHERE id=$1", [id]);
