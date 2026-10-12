import { extractText, getDocumentProxy } from "unpdf";

interface PdfAnnotation {
  subtype?: string;
  fieldType?: string;
  fieldName?: string;
  /** Tooltip/Beschriftung des Formularfelds – oft aussagekräftiger als der technische Feldname. */
  alternativeText?: string;
  fieldValue?: unknown;
  contents?: string;
  /** Neuere pdf.js-Versionen liefern den Text eingefügter Textfelder (FreeText) hier statt in `contents`. */
  contentsObj?: { str?: string };
  textContent?: string[];
  /** [x1, y1, x2, y2] in PDF-Koordinaten (y wächst nach oben). */
  rect?: number[];
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Text eines eingefügten Textfelds (FreeText) – je nach pdf.js-Version an unterschiedlicher Stelle. */
const freeTextOf = (a: PdfAnnotation) => (a.contents?.trim() || a.contentsObj?.str?.trim() || a.textContent?.join(" ").trim() || "").replace(/\s+/g, " ");

/** Platzhalter-Linien, Kästchen und Einheiten aus einer Beschriftung entfernen. */
const cleanLabel = (s: string) =>
  s
    .replace(/_{2,}\s*(m2|m²|qm|kwh|€|eur)?/gi, " ")
    .replace(/[□☐]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:\s]+$/, "");

/**
 * Beschriftung zu einem Eintrag an Position (x, y): die Textzeilen links davon in derselben Tabellenzeile
 * (z. B. „Wohnfläche“ für die eingetragene „150“). So kommt auch bei PDFs, die "von Hand" mit eingefügtem Text
 * ausgefüllt wurden, die Zuordnung Bezeichnung → Wert bei der KI an.
 */
function labelLeftOf(items: TextItem[], x: number, yTop: number, yBottom: number): string {
  const mid = (yTop + yBottom) / 2;
  const sameRow = items.filter((i) => i.x < x - 2 && !/[□☐]/.test(i.str) && cleanLabel(i.str).length > 1 && Math.abs(i.y - mid) <= 16);
  if (!sameRow.length) return "";
  // Mehrzeilige Beschriftungen (z. B. „Name des Hausbesitzers / (Antragstellers):“) von oben nach unten zusammensetzen.
  return cleanLabel(
    sameRow
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((i) => i.str)
      .join(" "),
  ).slice(0, 80);
}

/** Gezeichnetes Kreuz über einem Kästchen ("□Ja □Nein")? Dann: Zeilenbeschriftung + angekreuzte Option. */
function checkedOption(items: TextItem[], rect: number[], seen: Set<string>): string | null {
  const [x1, y1, x2, y2] = rect;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  for (const item of items) {
    if (!/[□☐]/.test(item.str) || Math.abs(item.y - cy) > 14) continue;
    // Optionen innerhalb des Textstücks (z. B. "□Ja□Nein") anhand der ungefähren Zeichenposition finden.
    const chars = item.str.length || 1;
    const perChar = item.width / chars;
    const options = [...item.str.matchAll(/[□☐]\s*([^□☐]+)/g)].map((m) => ({ text: m[1].trim(), start: item.x + (m.index ?? 0) * perChar, end: item.x + ((m.index ?? 0) + m[0].length) * perChar }));
    const hit = options.find((o) => cx >= o.start - 8 && cx <= o.end + 4);
    if (hit) {
      // Ein gezeichnetes X besteht oft aus zwei Strichen (zwei Annotationen) – nur einmal zählen.
      const key = `${item.x}|${item.y}|${hit.text}`;
      if (seen.has(key)) return "";
      seen.add(key);
      const row = labelLeftOf(items, item.x, cy + 6, cy - 6);
      return `[Formularfeld] ${row || "Auswahl"}: ${hit.text} (angekreuzt)`;
    }
  }
  return null;
}

/**
 * Normaler Seitentext enthält NICHT, was in ausfüllbare Formularfelder getippt, als Text eingefügt oder mit
 * Finger/Stift eingezeichnet wurde (liegt als Annotation im PDF). Das wird hier als zusätzlicher Text angehängt,
 * damit Ausgefüllt-Prüfung und Auslesen der Angaben es sehen – wo möglich mit der zugehörigen Beschriftung.
 */
async function extractAnnotationText(doc: Awaited<ReturnType<typeof getDocumentProxy>>): Promise<string> {
  const lines: string[] = [];
  let signature = false;
  const seenChecks = new Set<string>();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const annotations = (await page.getAnnotations()) as PdfAnnotation[];
    if (!annotations.length) continue;
    const content = await page.getTextContent().catch(() => ({ items: [] as unknown[] }));
    const items: TextItem[] = (content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter((t) => t.str && t.transform)
      .map((t) => ({ str: t.str!, x: t.transform![4], y: t.transform![5], width: t.width ?? 0 }));

    for (const a of annotations) {
      const value = Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : typeof a.fieldValue === "string" ? a.fieldValue.trim() : "";
      const rect = a.rect && a.rect.length === 4 ? a.rect : null;
      if (a.subtype === "Widget" && a.fieldType === "Sig") {
        signature = true;
      } else if (a.subtype === "Widget" && value && value !== "Off") {
        const label = a.alternativeText?.trim() || (rect ? labelLeftOf(items, rect[0], rect[3], rect[1]) : "") || a.fieldName || "Feld";
        lines.push(`[Formularfeld] ${label}: ${value}`);
      } else if (a.subtype === "FreeText" && freeTextOf(a)) {
        const label = rect ? labelLeftOf(items, rect[0], rect[3], rect[1]) : "";
        lines.push(label ? `[Formularfeld] ${label}: ${freeTextOf(a)}` : `[Eingefügter Text] ${freeTextOf(a)}`);
      } else if (a.subtype === "Ink" || a.subtype === "Stamp") {
        // Von Hand gezeichnetes Kreuz in einem Kästchen – oder eine Unterschrift.
        const check = a.subtype === "Ink" && rect ? checkedOption(items, rect, seenChecks) : null;
        if (check) lines.push(check);
        else if (check === null) signature = true;
      }
    }
  }
  if (signature) lines.push("[Unterschrift/Handzeichen vorhanden]");
  return [...new Set(lines)].join("\n");
}

/**
 * Extrahiert Text aus einer PDF-Datei (für die KI-Vorlagen-Zuordnung/-Prüfung), inklusive Formularfeld-Werten,
 * eingefügtem Text, angekreuzten Kästchen und Hinweis auf Unterschriften. Bewusst "unpdf" statt "pdf-parse" v2:
 * Letzteres zieht pdfjs-dist mit Canvas-Rendering nach, das in Vercels Serverless-Umgebung ohne DOMMatrix-Polyfill
 * abstürzt (ReferenceError beim Modul-Laden). unpdf ist für genau diese Umgebungen gebaut und braucht kein Canvas.
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
