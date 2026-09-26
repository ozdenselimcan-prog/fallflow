import { BUILDING_TYPES } from "@/lib/cases/fields";

/**
 * Regelbasierter Extraktor (Mock-Modus ohne KI-Key und Fallback bei ungültigen KI-Antworten).
 * Läuft komplett offline und ist bewusst konservativ: lieber ein Feld auslassen als raten.
 */
export function detectService(text: string): string {
  const t = text.toLowerCase();
  if (/isfp|sanierungsfahrplan/.test(t)) return "iSFP";
  if (/energieausweis/.test(t)) return "Energieausweis";
  if (/förder|foerder|bafa|kfw/.test(t)) return "Fördermittelberatung";
  if (/baubegleitung/.test(t)) return "Baubegleitung";
  if (/heizung|wärmepumpe|waermepumpe|heizungstausch/.test(t)) return "Heizung";
  if (/sanier|dämm|daemm/.test(t)) return "Sanierung";
  if (/energieberat|beratung/.test(t)) return "Energieberatung";
  return "";
}

export function detectBuildingType(text: string): string {
  const t = text.toLowerCase();
  if (/mehrfamilien|\bmfh\b/.test(t)) return BUILDING_TYPES[1];
  if (/einfamilien|\befh\b|doppelhaushälfte|reihenhaus/.test(t)) return BUILDING_TYPES[0];
  return "";
}

export function detectHeating(text: string): string {
  const t = text.toLowerCase();
  if (/wärmepumpe|waermepumpe/.test(t)) return "Wärmepumpe";
  if (/fernwärme|fernwaerme/.test(t)) return "Fernwärme";
  if (/pellet|holz/.test(t)) return "Holz/Pellets";
  if (/\böl\b|ölheizung|oelheizung|heizöl/.test(t)) return "Öl";
  if (/\bgas\b|gasheizung|erdgas/.test(t)) return "Gas";
  if (/strom|nachtspeicher|elektro/.test(t)) return "Strom";
  return "";
}

/** Nur ausdrückliche Aussagen – „wir haben ein Haus“ sagt nichts über den Eigentümerstatus. */
export function detectOwnerStatus(text: string): string {
  const t = text.toLowerCase();
  if (/hausverwaltung|\bverwalter|weg-verwalt/.test(t)) return "Verwalter";
  if (/\bmieter|\bmiete\b|zur miete/.test(t)) return "Mieter";
  if (/eigentümer|eigentuemer|hausbesitzer|hauseigentümer/.test(t)) return "Eigentümer";
  return "";
}

const NOT_A_NAME = /^(eigentümer|eigentuemer|mieter|verwalter|hausbesitzer|interessiert|auf der suche|neu)/i;
const STREET = /(\p{Lu}[\p{L}.-]*(?:\s\p{L}[\p{L}.-]*){0,2}?(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|ufer|damm|chaussee)\s*\d{1,4}\s?[a-z]?)(?![\p{L}\d])/iu;

export function heuristicExtract(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => v && (out[k] = v);
  const currentYear = new Date().getFullYear();

  set("service", detectService(text));
  set("buildingType", detectBuildingType(text));
  set("heating", detectHeating(text));
  set("ownerStatus", detectOwnerStatus(text));

  const year = text.match(/(?:baujahr|gebaut|aus dem jahr|von|aus)\D{0,22}(1[6-9]\d{2}|20[0-4]\d)/i)?.[1];
  if (year && Number(year) <= currentYear) out.yearBuilt = year;

  const area = text.match(/(\d{2,5})(?:[.,]\d+)?\s*(?:m²|m2|qm|quadratmeter)/i)?.[1];
  if (area) out.livingArea = area;

  const floors = text.match(/(\d{1,2})\s*(?:etagen|geschosse|geschossig|stockwerke|vollgeschosse)/i)?.[1];
  if (floors && Number(floors) >= 1 && Number(floors) <= 30) out.floors = floors;

  set("street", text.match(STREET)?.[1]?.trim());

  const plz = text.match(/(?<!\d)(0[1-9]\d{3}|[1-9]\d{4})(?!\d)/g)?.find((p) => p !== out.yearBuilt && p !== out.livingArea);
  if (plz) out.postalCode = plz;

  set("email", text.match(/[^\s@,;<>]{1,64}@[^\s@,;<>]{1,255}\.[a-z]{2,}/i)?.[0]?.toLowerCase());
  set("phone", text.match(/(?<!\d)(?:\+49|0)[\d\s/()-]{7,18}\d/)?.[0]?.trim());

  const name = text.match(/(?:ich bin|mein name ist|ich heiße|hier ist|hier spricht)\s+(?:herr |frau )?(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?)/u)?.[1];
  if (name && !NOT_A_NAME.test(name)) out.name = name;

  set("description", text.trim().slice(0, 1000));
  return out;
}
