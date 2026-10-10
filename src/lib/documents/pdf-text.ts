import { extractText, getDocumentProxy } from "unpdf";

interface PdfAnnotation {
  subtype?: string;
  fieldType?: string;
  fieldName?: string;
  /** Tooltip/Beschriftung des Formularfelds – oft aussagekräftiger als der technische Feldname. */
  alternativeText?: string;
  fieldValue?: unknown;
  contents?: string;
}

/**
 * Normaler Seitentext enthält NICHT, was in ausfüllbare Formularfelder getippt wurde (liegt als Annotation im
 * PDF) und auch keine mit Finger/Stift gezeichnete Unterschrift. Beides wird hier als zusätzlicher Text
 * angehängt, damit die Ausgefüllt-Prüfung es sieht (sonst hieß es fälschlich "Datum/Unterschrift fehlen").
 */
async function extractAnnotationText(doc: Awaited<ReturnType<typeof getDocumentProxy>>): Promise<string> {
  const lines: string[] = [];
  let signature = false;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const annotations = (await page.getAnnotations()) as PdfAnnotation[];
    for (const a of annotations) {
      const value = Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : typeof a.fieldValue === "string" ? a.fieldValue.trim() : "";
      if (a.subtype === "Widget" && a.fieldType === "Sig") {
        signature = true;
      } else if (a.subtype === "Widget" && value && value !== "Off") {
        lines.push(`[Formularfeld] ${a.alternativeText?.trim() || a.fieldName || "Feld"}: ${value}`);
      } else if (a.subtype === "FreeText" && a.contents?.trim()) {
        lines.push(`[Eingefügter Text] ${a.contents.trim()}`);
      } else if (a.subtype === "Ink" || a.subtype === "Stamp") {
        signature = true;
      }
    }
  }
  if (signature) lines.push("[Unterschrift/Handzeichen vorhanden]");
  return lines.join("\n");
}

/**
 * Extrahiert Text aus einer PDF-Datei (für die KI-Vorlagen-Zuordnung/-Prüfung), inklusive Formularfeld-Werten
 * und Hinweis auf eingefügte Unterschriften. Bewusst "unpdf" statt "pdf-parse" v2: Letzteres zieht pdfjs-dist
 * mit Canvas-Rendering nach, das in Vercels Serverless-Umgebung ohne DOMMatrix-Polyfill abstürzt (ReferenceError
 * beim Modul-Laden). unpdf ist für genau diese Umgebungen (Edge/Serverless) gebaut und braucht kein Canvas.
 * Bei Fehlern: leerer String.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const doc = await getDocumentProxy(bytes);
    const { text } = await extractText(doc, { mergePages: true });
    const extra = await extractAnnotationText(doc).catch(() => "");
    return extra ? `${text}\n${extra}` : text;
  } catch (err) {
    console.error("[pdf] Textextraktion fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return "";
  }
}
