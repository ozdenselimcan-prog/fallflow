import { describe, expect, it } from "vitest";
import { extractEmbeddedJpegs } from "./pdf-images";

describe("extractEmbeddedJpegs", () => {
  it("holt eingebettete JPEG-Seiten aus einer gescannten PDF", () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 7), Buffer.from([0xff, 0xd9])]);
    const pdf = Buffer.concat([
      Buffer.from(`%PDF-1.4\n4 0 obj << /Type /XObject /Subtype /Image /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "latin1"),
      jpeg,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);
    const found = extractEmbeddedJpegs(new Uint8Array(pdf), { minBytes: 10 });
    expect(found).toHaveLength(1);
    expect(Buffer.from(found[0]).equals(jpeg)).toBe(true);
  });
  it("ohne Bilder: leer", () => {
    expect(extractEmbeddedJpegs(new TextEncoder().encode("%PDF-1.4\n%%EOF"))).toEqual([]);
  });
});
