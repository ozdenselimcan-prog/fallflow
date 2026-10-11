/**
 * Weitere Angaben aus vom Kunden ausgefüllten PDF-Vorlagen (alles außer den Standardfeldern wie Name, Adresse,
 * Baujahr). Gespeichert als ein Feld der Fallakte, eine Zeile je Angabe: "Bezeichnung: Wert".
 */
export const FORM_ENTRIES_KEY = "formEntries";

export interface FormEntryLine {
  label: string;
  value: string;
}

export function parseFormEntries(text: string | undefined): FormEntryLine[] {
  return (text ?? "")
    .split("\n")
    .map((line) => {
      const i = line.indexOf(": ");
      return i > 0 ? { label: line.slice(0, i).trim(), value: line.slice(i + 2).trim() } : null;
    })
    .filter((e): e is FormEntryLine => Boolean(e?.label && e.value));
}

/**
 * Ergänzt die gespeicherten Formularangaben um neue: gleiche Bezeichnung = neuer Wert (z. B. korrigierte Vorlage),
 * Werte, die schon als Standardangabe in der Fallakte stehen (Name, Straße …), werden nicht doppelt aufgeführt.
 */
export function mergeFormEntries(existing: string | undefined, incoming: FormEntryLine[], knownValues: string[]): string {
  const known = new Set(knownValues.map((v) => v.trim().toLowerCase()).filter(Boolean));
  const byLabel = new Map(parseFormEntries(existing).map((e) => [e.label.toLowerCase(), e]));
  for (const e of incoming) {
    if (known.has(e.value.trim().toLowerCase())) continue;
    byLabel.set(e.label.toLowerCase(), e);
  }
  let out = "";
  for (const e of byLabel.values()) {
    const line = `${e.label}: ${e.value}`;
    if (out.length + line.length + 1 > 3000) break;
    out = out ? `${out}\n${line}` : line;
  }
  return out;
}
