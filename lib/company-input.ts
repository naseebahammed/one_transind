// Pure (only relative, import-free siblings) so `node --test` can load it without the Next alias setup.
import type { RoomType } from "./companies.shared.ts";
import { cleanText, parseNonNegativeInt } from "./input-validation.ts";

export type CompanyInput = { name: string; sector: string; active: number; totalRooms: number; roomTypes: RoomType[]; propertyType: string; erpCode: string };

export const PROPERTY_TYPES = [
  ["apartments", "Apartments"], ["villa", "Villa"], ["property-mgmt", "Property Management"],
  ["restaurant", "Restaurant"], ["hospitality", "Hospitality"], ["supermarket", "Supermarket"],
  ["beauty-salon", "Beauty Salon"], ["retail-store", "Retail Store"], ["distributor", "Distributor"],
  ["holding-company", "Holding Company"], ["facility-service", "Facility Services"], ["cleaning-service", "Cleaning Services"],
  ["laundry", "Laundry & Dry Cleaning"], ["logistics", "Logistics & Warehousing"], ["freight-shipping", "Freight & Shipping"],
  ["customs", "Customs Clearance"],
] as const;

const MAX_ROOMS = 100_000;
const MAX_ROOM_PRICE = 100_000_000;

const str = (f: FormData, k: string, max: number) => cleanText(f.get(k), max);

/** Parses the hidden "roomTypes" JSON field; null means the input was malformed. */
function parseRoomTypes(raw: string): RoomType[] | null {
  if (raw.length > 20_000) return null;
  let arr: unknown;
  try { arr = JSON.parse(raw || "[]"); } catch { return null; }
  if (!Array.isArray(arr) || arr.length > 50) return null;
  const out: RoomType[] = [];
  for (const r of arr) {
    if (typeof r !== "object" || !r) return null;
    const o = r as Record<string, unknown>;
    const type = cleanText(o.type, 40);
    const rooms = Number(o.rooms), standardPrice = Number(o.standardPrice);
    if (!type || !Number.isInteger(rooms) || rooms < 0 || rooms > MAX_ROOMS || !Number.isFinite(standardPrice) || standardPrice < 0 || standardPrice > MAX_ROOM_PRICE) return null;
    out.push({ type, rooms, standardPrice });
  }
  return out;
}

export function parseCompany(f: FormData, sectors: readonly string[], propertyTypes: readonly string[]): { error: string } | { data: CompanyInput } {
  const data = { name: str(f, "name", 120), sector: str(f, "sector", 20), active: f.get("active") ? 1 : 0 };
  if (!data.name) return { error: "Name is required." };
  if (!sectors.includes(data.sector)) return { error: "Choose a sector." };
  const totalRooms = parseNonNegativeInt(f.get("totalRooms"), MAX_ROOMS, true);
  if (totalRooms === null) return { error: "Total rooms must be a non-negative whole number." };
  const roomTypes = parseRoomTypes(typeof f.get("roomTypes") === "string" ? String(f.get("roomTypes")) : "");
  if (!roomTypes) return { error: "Room types are invalid." };
  const propertyType = str(f, "propertyType", 20);
  if (propertyType && !propertyTypes.includes(propertyType)) return { error: "Choose a valid property type." };
  return { data: { ...data, totalRooms, roomTypes, propertyType, erpCode: str(f, "erpCode", 20) } };
}
