import { describe, expect, it } from "vitest";
import { extractPdfText } from "./pdf-text";

/** Minimales PDF mit einem Textfeld "Datum" (Wert 10.10.2026) und einer Ink-Annotation (gezeichnete Unterschrift). */
const PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [4 0 R] >> >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Annots [4 0 R 5 0 R] >> endobj
4 0 obj << /Type /Annot /Subtype /Widget /FT /Tx /T (Datum) /V (10.10.2026) /Rect [10 10 100 30] /P 3 0 R >> endobj
5 0 obj << /Type /Annot /Subtype /Ink /Rect [10 50 100 80] /InkList [[10 50 50 80 100 50]] /P 3 0 R >> endobj
trailer << /Root 1 0 R /Size 6 >>
%%EOF`;

describe("extractPdfText", () => {
  it("nimmt getippte Formularfelder und gezeichnete Unterschriften mit auf (sonst hieß es fälschlich 'Datum/Unterschrift fehlen')", async () => {
    const text = await extractPdfText(new TextEncoder().encode(PDF));
    expect(text).toContain("[Formularfeld] Datum: 10.10.2026");
    expect(text).toContain("[Unterschrift/Handzeichen vorhanden]");
  });
});
