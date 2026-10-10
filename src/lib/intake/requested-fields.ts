/**
 * Erkennt in der vom Büro geschriebenen Leistungs-Nachricht, welche Angaben vom Kunden gewünscht werden
 * (z. B. "Wir benötigen Ihre Telefonnummer und E-Mail-Adresse"). Bei E-Mail-Fällen gibt es keinen Frage-Flow –
 * stattdessen zählen genau diese vom Büro selbst genannten Angaben als benötigt. Reine Logik, läuft auch im Browser.
 */

const FIELD_KEYWORDS: Record<string, RegExp> = {
  phone: /telefon|handynummer|mobilnummer|rufnummer|\bnummer\b|\btel\b/i,
  email: /e-?mail|\bmail\b|mail-?adresse/i,
  name: /\bname\b|vor- und nachname|vollständigen name/i,
  street: /adresse|anschrift|straße|strasse|hausnummer/i,
  postalCode: /\bplz\b|postleitzahl/i,
  yearBuilt: /baujahr/i,
  livingArea: /wohnfläche|wohnflaeche|quadratmeter|\bfläche\b/i,
  heating: /heizung/i,
  buildingType: /gebäudetyp|gebaeudetyp|gebäudeart|gebaeudeart/i,
  ownerStatus: /eigentümer|eigentuemer/i,
};

/** Nur Sätze, die ausdrücklich etwas vom Kunden verlangen, zählen – sonst würde "wir melden uns per Telefon" als Anforderung gelten. */
const REQUEST_SENTENCE = /benötig|benoetig|brauch|bitte|teilen sie|nennen sie|geben sie|senden sie|schicken sie|erforderlich|angaben|mitteilen|übermitteln|uebermitteln/i;

export function requestedFieldKeys(body: string): string[] {
  const keys = new Set<string>();
  for (const sentence of body.split(/[.!?\n]+/)) {
    if (!REQUEST_SENTENCE.test(sentence)) continue;
    for (const [key, re] of Object.entries(FIELD_KEYWORDS)) if (re.test(sentence)) keys.add(key);
  }
  return [...keys];
}
