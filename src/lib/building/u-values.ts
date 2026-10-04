/**
 * Grobe U-Wert-Richtwerte je Baualtersklasse (W/(m²K)) – angelehnt an die gängige deutsche
 * Gebäudetypologie (u. a. IWU/dena), keine KI-Generierung: feste Nachschlagetabelle, kein Fall für
 * erfundene Zahlen. Nur eine Orientierung für die Vorbereitung, kein Messwert – der Energieberater
 * bestätigt oder verwirft jeden Wert einzeln, bevor er in die Fallakte übernommen wird.
 */

interface BuildingClass {
  label: string;
  maxYear: number | null;
  wall: number;
  window: number;
  roof: number;
}

const CLASSES: BuildingClass[] = [
  { label: "vor 1948", maxYear: 1948, wall: 1.7, window: 2.8, roof: 1.3 },
  { label: "1949–1957", maxYear: 1957, wall: 1.4, window: 2.8, roof: 1.0 },
  { label: "1958–1968", maxYear: 1968, wall: 1.4, window: 2.7, roof: 1.0 },
  { label: "1969–1978", maxYear: 1978, wall: 1.0, window: 2.7, roof: 0.8 },
  { label: "1979–1983 (1. WSVO)", maxYear: 1983, wall: 0.9, window: 2.7, roof: 0.5 },
  { label: "1984–1994 (2. WSVO)", maxYear: 1994, wall: 0.6, window: 2.7, roof: 0.4 },
  { label: "1995–2001 (3. WSVO)", maxYear: 2001, wall: 0.5, window: 1.8, roof: 0.3 },
  { label: "2002–2009 (EnEV 2002/2004)", maxYear: 2009, wall: 0.35, window: 1.6, roof: 0.25 },
  { label: "2010–2015 (EnEV 2009/2014)", maxYear: 2015, wall: 0.28, window: 1.3, roof: 0.2 },
  { label: "ab 2016 (EnEV 2016/GEG)", maxYear: null, wall: 0.24, window: 1.1, roof: 0.18 },
];

export interface UValueSuggestion {
  classLabel: string;
  wall: number;
  window: number;
  roof: number;
}

/** null = kein (plausibles) Baujahr bekannt. */
export function estimateUValues(yearBuiltRaw: string | undefined): UValueSuggestion | null {
  const year = Number(yearBuiltRaw);
  if (!yearBuiltRaw || !Number.isFinite(year) || year < 1800 || year > new Date().getFullYear()) return null;
  const match = CLASSES.find((c) => c.maxYear === null || year <= c.maxYear);
  if (!match) return null;
  return { classLabel: match.label, wall: match.wall, window: match.window, roof: match.roof };
}
