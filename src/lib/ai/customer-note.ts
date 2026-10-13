/**
 * Sicherheitsnetz für Prüf-Hinweise der KI, die wörtlich an den Kunden gehen (z. B. „Beim Prüfen ist uns aufgefallen: …“):
 * Rutscht ein technischer Feldname aus dem JSON durch („type, floors, heating fehlen“), wird er ins Deutsche übersetzt.
 */
const FIELD_LABELS: Record<string, string> = {
  type: "Gebäudetyp",
  buildingType: "Gebäudetyp",
  floors: "Anzahl der Etagen",
  heating: "Heizung",
  heatingType: "Heizung",
  service: "gewünschte Leistung",
  yearBuilt: "Baujahr",
  livingArea: "Wohnfläche",
  postalCode: "PLZ",
  street: "Straße",
  ownerStatus: "Eigentümerstatus",
  name: "Name",
  email: "E-Mail",
  phone: "Telefon",
  description: "Beschreibung",
  customer: "Kundendaten",
  property: "Angaben zum Gebäude",
  request: "Anliegen",
};

const KEY = new RegExp(`\\b(${Object.keys(FIELD_LABELS).join("|")})\\b`, "g");

export function customerFacingNote(note: string): string {
  // Nur ersetzen, wo der englische Name als eigenes Wort steht (deutsche Wörter wie „Name“ bleiben unverändert).
  const out = note.replace(KEY, (k) => FIELD_LABELS[k] ?? k);
  // „…, Heizung fehlen“ → Satzzeichen am Ende ergänzen, damit der Folgesatz sauber anschließt.
  return out && !/[.!?]$/.test(out.trim()) ? `${out.trim()}.` : out.trim();
}
