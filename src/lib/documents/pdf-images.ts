/**
 * Holt die eingebetteten JPEG-Bilder aus einer PDF – typisch für eingescannte Formulare, bei denen jede Seite ein
 * Foto ist. So bekommt die KI die Seiten in voller Auflösung zu sehen (deutlich besser lesbare Handschrift als über
 * die PDF-Eingabe). Bewusst einfach gehalten: nur direkt angegebene Stream-Längen, keine anderen Bildformate.
 */
export function extractEmbeddedJpegs(pdf: Uint8Array, opts: { minBytes?: number; max?: number } = {}): Uint8Array[] {
  const minBytes = opts.minBytes ?? 30_000;
  const max = opts.max ?? 4;
  const text = Buffer.from(pdf).toString("latin1");
  const out: Uint8Array[] = [];
  let from = 0;
  while (out.length < max) {
    const filter = text.indexOf("/DCTDecode", from);
    if (filter < 0) break;
    from = filter + 10;
    const dictStart = text.lastIndexOf("<<", filter);
    const streamKw = text.indexOf("stream", filter);
    if (dictStart < 0 || streamKw < 0) continue;
    const dict = text.slice(dictStart, streamKw);
    const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    let start = streamKw + "stream".length;
    if (text[start] === "\r") start++;
    if (text[start] === "\n") start++;
    const end = length ? start + Number(length[1]) : text.indexOf("endstream", start);
    if (end <= start || end > pdf.length) continue;
    const bytes = pdf.slice(start, end);
    // Gültiges JPEG beginnt mit FF D8.
    if (bytes.length >= minBytes && bytes[0] === 0xff && bytes[1] === 0xd8) out.push(bytes);
    from = end;
  }
  return out;
}
