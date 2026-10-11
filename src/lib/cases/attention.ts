/**
 * Fallfeld für "Aufmerksamkeit benötigt": Grund, warum die KI auf eine E-Mail bewusst NICHT automatisch geantwortet
 * hat (Leistung unklar, Kunde stellt eine Frage, wünscht persönlichen Kontakt). Leer bzw. fehlend = alles erledigt.
 */
export const ATTENTION_KEY = "needsAttention";

export const attentionOf = (fields: Record<string, string>): string => (fields[ATTENTION_KEY] ?? "").trim().replace(/[.?!]+$/, "");
