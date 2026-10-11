import type { DocumentKind } from "@/lib/data/types";

/** Wie Büros Grundriss bzw. Energieausweis in ihren Nachrichten nennen (inkl. Mehrzahl und gängiger Synonyme). */
const SYNONYMS: Partial<Record<DocumentKind, RegExp>> = {
  floorplan: /grundri(ss|ß)|baupl(a|ä)n|gebäudepl(a|ä)n|hauspl(a|ä)n|bauzeichnung|wohnungspl(a|ä)n|raumpl(a|ä)n|planunterlagen/i,
  energy_certificate: /energieausweis|energiepass|energiebedarfsausweis|energieverbrauchsausweis/i,
};

/** Woran man erkennt, dass ein Satz etwas vom Kunden anfordert (nicht nur die Leistung benennt). */
const REQUEST = /benötig|brauch|schick|send|übermitt|zukommen|beifüg|beileg|mitschick|nachreich|anhäng|bitte|vorlegen|bereitstell|haben sie|liegt .* vor|falls vorhanden/i;

/**
 * Fordert das Büro dieses Dokument in seiner eigenen Nachricht schon selbst an (z. B. "Bitte schicken Sie uns Ihre
 * Baupläne")? Dann wiederholt FallFlow es nicht noch einmal. Nur ein Satz, der das Dokument nennt UND etwas anfordert,
 * zählt – "Danke für Ihre Anfrage zum Energieausweis" fordert keinen alten Energieausweis an.
 */
export function officeAlreadyRequests(message: string, kind: DocumentKind): boolean {
  const pattern = SYNONYMS[kind];
  if (!pattern || !message.trim()) return false;
  return message
    .split(/(?<=[.!?:;])\s+|\n+/)
    .some((sentence) => pattern.test(sentence) && REQUEST.test(sentence));
}
