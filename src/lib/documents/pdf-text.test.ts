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

/** Vorlage, die "von Hand" mit eingefügtem Text ausgefüllt wurde (Adobe-Reader "Text hinzufügen"): Wert ohne Formularfeld. */
const STREAM = "BT /F1 10 Tf 20 150 Td (Wohnflaeche: ______ m2) Tj ET BT /F1 10 Tf 20 100 Td (Baujahr:) Tj ET";
const FREE_TEXT_PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> /Annots [4 0 R 5 0 R] >> endobj
4 0 obj << /Type /Annot /Subtype /FreeText /Contents (150) /Rect [100 146 140 160] /DA (/Helv 10 Tf 0 g) /P 3 0 R >> endobj
5 0 obj << /Type /Annot /Subtype /FreeText /Contents (1999) /Rect [100 96 140 110] /DA (/Helv 10 Tf 0 g) /P 3 0 R >> endobj
6 0 obj << /Length ${STREAM.length} >> stream
${STREAM}
endstream endobj
7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R /Size 8 >>
%%EOF`;

describe("extractPdfText – eingefügter Text", () => {
  it("ordnet eingefügten Text der Beschriftung links daneben zu (z. B. Wohnfläche: 150)", async () => {
    const text = await extractPdfText(new TextEncoder().encode(FREE_TEXT_PDF));
    expect(text).toContain("[Formularfeld] Wohnflaeche: 150");
    expect(text).toContain("[Formularfeld] Baujahr: 1999");
  });
});
