import { PDFParse } from "pdf-parse";

/** Extrahiert reinen Text aus einer PDF-Datei (für die KI-Vorlagen-Zuordnung). Bei Fehlern: leerer String. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text;
  } catch (err) {
    console.error("[pdf] Textextraktion fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return "";
  } finally {
    await parser.destroy();
  }
}
