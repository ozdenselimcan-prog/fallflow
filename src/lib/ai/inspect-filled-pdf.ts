import { z } from "zod";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import { getAiProvider } from "./provider";
import { extractionSchema, extractionToFields } from "./schema";
import type { FormEntry, FormExtraction } from "./form-extractor";

/** Bildfähiges Modell, das PDF-Seiten "sieht" (auch Scans, Fotos, Handschrift). */
const VISION_MODEL = "gpt-4o-mini";
/** Größere PDFs (z. B. hochaufgelöste Scans) nicht an die KI schicken. */
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const RULES = EXTRACTION_SYSTEM_PROMPT.slice(EXTRACTION_SYSTEM_PROMPT.indexOf("Regeln:")).replace(/Der Text zwischen <anfrage>[^\n]*$/, "");

const SYSTEM = `Du prüfst ein vom Kunden zurückgeschicktes Formular eines deutschen Energieberatungsbüros, das als die Vorlage "{title}"
erwartet wird. Du siehst die PDF-Seiten wie ein Mensch – auch eingescannte, fotografierte oder von Hand ausgefüllte Formulare.

1. wrongDocument: true nur, wenn es offensichtlich ein ANDERES Dokument ist (andere Überschrift/Zweck). Der Büroname im Briefkopf
   sagt nichts über die Art des Dokuments.
2. filled: true, wenn die wesentlichen Felder sichtbar ausgefüllt sind (getippt, eingefügt, handschriftlich, angekreuzt).
   false nur, wenn nichts oder erkennbar zu wenig eingetragen ist. Unterschriften NIE als fehlend bemängeln.
   note: bei filled=false konkret, WELCHE Felder leer sind (max. 140 Zeichen); sonst kurze Bestätigung.
3. Lies ALLE Eintragungen des Kunden aus (nicht den Vordruck, nicht die Angaben des Büros) und fülle damit das JSON:
   customer/property/heating/request wie unten beschrieben, und formEntries = alle übrigen Eintragungen
   ({"label": Bezeichnung aus dem Formular, "value": Eintrag}), angekreuzte Kästchen als value "Ja"/"Nein"/gewählte Option.
   Name des Hausbesitzers/Antragstellers = customer.name; Adresse des Gebäudes = property.street/postalCode.
   Handschrift, die du nicht sicher lesen kannst, lässt du weg statt zu raten.

Antworte AUSSCHLIESSLICH mit JSON:
{"wrongDocument": false, "filled": true, "note": "",
 "customer": {"name": "", "email": "", "phone": "", "ownerStatus": ""},
 "property": {"type": "", "yearBuilt": null, "livingArea": null, "floors": null, "street": "", "postalCode": ""},
 "heating": {"type": ""}, "request": {"service": "", "description": ""},
 "missingFields": [], "completionPercent": 0, "formEntries": []}
${RULES}`;

const schema = extractionSchema.extend({
  wrongDocument: z.boolean().default(false),
  filled: z.boolean(),
  note: z.string().max(300).default(""),
  formEntries: z.array(z.object({ label: z.string().default(""), value: z.string().default("") })).max(60).default([]),
});

export interface VisualInspection {
  filled: boolean;
  wrongDocument: boolean;
  note: string;
  extraction: FormExtraction;
}

const tidy = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Prüft und liest ein zurückgeschicktes Formular anhand der PDF-Seiten selbst (Vision) – für Fälle, in denen im
 * PDF kein auslesbarer Text steckt (Scan, Foto, Handschrift, Stift auf dem Tablet) oder die Text-Prüfung das
 * Formular für leer hält. null = keine KI verfügbar, Datei zu groß oder Fehler (dann entscheidet ein Mensch).
 */
export async function inspectFilledPdf(title: string, pdf: Uint8Array, fileName: string): Promise<VisualInspection | null> {
  const provider = getAiProvider(VISION_MODEL);
  if (!provider || pdf.length > MAX_PDF_BYTES) return null;
  try {
    const raw = await provider.completeJsonWithPdf(SYSTEM.replaceAll("{title}", title), `Erwartete Vorlage: "${title}". Bitte das angehängte Formular prüfen und auslesen.`, {
      filename: fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`,
      base64: Buffer.from(pdf).toString("base64"),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return null;
    const fields = extractionToFields(parsed.data);
    delete fields.description;
    const entries: FormEntry[] = parsed.data.formEntries
      .map((e) => ({ label: tidy(e.label, 80), value: tidy(e.value, 300) }))
      .filter((e) => e.label && e.value)
      .slice(0, 40);
    return { filled: parsed.data.filled, wrongDocument: parsed.data.wrongDocument, note: tidy(parsed.data.note, 200), extraction: { fields, entries } };
  } catch (err) {
    console.error("[ai] Visuelle Formularprüfung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return null;
  }
}
