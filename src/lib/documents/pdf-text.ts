import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extrahiert reinen Text aus einer PDF-Datei (für die KI-Vorlagen-Zuordnung). Bewusst "unpdf" statt
 * "pdf-parse" v2: Letzteres zieht pdfjs-dist mit Canvas-Rendering nach, das in Vercels Serverless-
 * Umgebung ohne DOMMatrix-Polyfill abstürzt (ReferenceError beim Modul-Laden). unpdf ist für genau
 * diese Umgebungen (Edge/Serverless) gebaut und braucht kein Canvas. Bei Fehlern: leerer String.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const doc = await getDocumentProxy(bytes);
    const { text } = await extractText(doc, { mergePages: true });
    return text;
  } catch (err) {
    console.error("[pdf] Textextraktion fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return "";
  }
}
