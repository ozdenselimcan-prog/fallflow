import { apiError, json, withSession } from "@/lib/api";
import { suggestTemplateService } from "@/lib/ai/suggest-template-service";
import { sanitizeFileName, saveFile, sniffMime } from "@/lib/documents/storage";
import { extractPdfText } from "@/lib/documents/pdf-text";

export const GET = withSession(async (_req, { store }) => json({ templates: await store.listDocumentTemplates() }));

const MAX_BYTES = 10 * 1024 * 1024;

/** Büro lädt eine PDF-Vorlage (z. B. Vollmacht) hoch; die KI schlägt direkt die passende Leistung vor. */
export const POST = withSession(
  async (req, { store, session }) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return apiError("Ungültige Anfrage", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("Bitte wählen Sie eine PDF-Datei aus.", 400);
    if (file.size === 0) return apiError("Die Datei ist leer.", 400);
    if (file.size > MAX_BYTES) return apiError("Die Datei ist zu groß (maximal 10 MB).", 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffMime(bytes);
    if (mime !== "application/pdf") return apiError("Nur PDF-Dateien sind erlaubt.", 415);

    const fileName = sanitizeFileName(file.name, "pdf");
    // Kopie übergeben: die PDF-Textextraktion übernimmt den Speicher des übergebenen Arrays (wie bei
    // pdf.js üblich), danach wäre "bytes" leer – der Upload unten braucht die unangetasteten Originaldaten.
    const text = await extractPdfText(bytes.slice());
    const suggested = await suggestTemplateService(fileName, text);

    const storagePath = await saveFile({ companyId: session.companyId, caseId: "templates", bytes, mime });
    const template = await store.saveDocumentTemplate({ service: suggested ?? "", title: fileName.replace(/\.pdf$/i, ""), fileName, storagePath });
    return json({ template, suggested: Boolean(suggested) }, 201);
  },
  { permission: "company:manage" },
);
