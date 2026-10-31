import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { euro, quoteTotals, type Quote } from "@/lib/quote";

/**
 * Angebot als PDF (A4): Briefkopf des Betriebs, Kunde, Angebotsnummer, Positionen, Summen und Gültigkeit.
 * Standardschrift Helvetica (WinAnsi: Umlaute, ß, € und „“ funktionieren).
 */
export interface QuotePdfInput {
  company: { name: string; address: string; phone: string; website: string; email: string };
  customer: { name: string; street: string; city: string };
  service: string;
  quote: Quote;
  date: Date;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 56;
const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

/** Text auf Zeilenbreite umbrechen. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Zeichen, die Helvetica (WinAnsi) nicht kennt, ersetzen – sonst bricht pdf-lib ab. */
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ€„“‚‘’–—…•]/g, "");

export async function buildQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Angebot ${input.quote.number}`);
  doc.setAuthor(input.company.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const gray = rgb(0.4, 0.4, 0.45);
  const text = (t: string, x: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.12)) => page.drawText(safe(t), { x, y, size, font: f, color });
  const right = (t: string, xr: number, size = 10, f = font) => page.drawText(safe(t), { x: xr - f.widthOfTextAtSize(safe(t), size), y, size, font: f });
  const newPageIfNeeded = (need: number) => {
    if (y - need < M) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
  };

  // Briefkopf
  text(input.company.name, M, 16, bold);
  y -= 16;
  const contact = [input.company.address, input.company.phone && `Tel. ${input.company.phone}`, input.company.email, input.company.website].filter(Boolean).join(" · ");
  for (const l of wrap(safe(contact), font, 9, A4.w - 2 * M)) {
    text(l, M, 9, font, gray);
    y -= 12;
  }
  y -= 24;

  // Empfänger und Kopfdaten
  const top = y;
  for (const l of [input.customer.name, input.customer.street, input.customer.city].filter(Boolean)) {
    text(l, M, 11);
    y -= 15;
  }
  y = top;
  right(`Angebot Nr. ${input.quote.number}`, A4.w - M, 10, bold);
  y -= 14;
  right(`Datum: ${dateFmt.format(input.date)}`, A4.w - M);
  y -= 14;
  const validUntil = new Date(input.date.getTime() + input.quote.validDays * 86_400_000);
  right(`Gültig bis: ${dateFmt.format(validUntil)}`, A4.w - M);
  y = Math.min(y, top - 45) - 30;

  text(`Angebot${input.service ? `: ${input.service}` : ""}`, M, 14, bold);
  y -= 22;
  if (input.quote.intro.trim()) {
    for (const l of wrap(safe(input.quote.intro.trim()), font, 10, A4.w - 2 * M)) {
      newPageIfNeeded(14);
      text(l, M, 10);
      y -= 14;
    }
    y -= 10;
  }

  // Tabelle
  const col = { pos: M, title: M + 28, qty: A4.w - M - 210, unit: A4.w - M - 160, price: A4.w - M - 80, sum: A4.w - M };
  const header = () => {
    page.drawRectangle({ x: M - 4, y: y - 5, width: A4.w - 2 * M + 8, height: 18, color: rgb(0.95, 0.95, 0.96) });
    text("Pos.", col.pos, 9, bold);
    text("Leistung", col.title, 9, bold);
    right("Menge", col.qty + 30, 9, bold);
    text("Einheit", col.unit, 9, bold);
    right("Einzelpreis", col.price + 50, 9, bold);
    right("Gesamt", col.sum, 9, bold);
    y -= 22;
  };
  header();
  input.quote.items.forEach((item, idx) => {
    const lines = wrap(safe(item.title), font, 10, col.qty - col.title - 10);
    newPageIfNeeded(lines.length * 13 + 8);
    if (y > A4.h - M - 5) header();
    text(String(idx + 1), col.pos);
    right(String(item.qty).replace(".", ","), col.qty + 30);
    text(item.unit, col.unit);
    right(item.unitPrice === null ? "–" : euro(item.unitPrice), col.price + 50);
    right(item.unitPrice === null ? "–" : euro(item.unitPrice * item.qty), col.sum);
    lines.forEach((l, i) => {
      text(l, col.title);
      if (i < lines.length - 1) y -= 13;
    });
    y -= 18;
  });

  // Summen
  const t = quoteTotals(input.quote);
  newPageIfNeeded(80);
  page.drawLine({ start: { x: A4.w - M - 220, y: y + 6 }, end: { x: A4.w - M, y: y + 6 }, thickness: 0.6, color: gray });
  y -= 8;
  const sumRow = (label: string, value: string, f = font) => {
    right(label, A4.w - M - 100, 10, f);
    right(value, A4.w - M, 10, f);
    y -= 15;
  };
  if (input.quote.vatRate > 0) {
    sumRow("Nettobetrag", euro(t.net));
    sumRow(`zzgl. ${input.quote.vatRate} % MwSt.`, euro(t.vat));
    sumRow("Gesamtbetrag", euro(t.gross), bold);
  } else {
    sumRow("Gesamtbetrag", euro(t.gross), bold);
    y -= 4;
    text("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.", M, 9, font, gray);
    y -= 14;
  }
  y -= 20;
  newPageIfNeeded(40);
  for (const l of wrap("Dieses Angebot ist freibleibend. Bei Fragen melden Sie sich gern – wir freuen uns auf Ihren Auftrag.", font, 10, A4.w - 2 * M)) {
    text(l, M, 10);
    y -= 14;
  }
  return doc.save();
}
