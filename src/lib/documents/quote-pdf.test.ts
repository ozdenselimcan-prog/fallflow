import { describe, expect, it } from "vitest";
import { quoteNumber, quoteTotals, readQuote, type Quote } from "@/lib/quote";
import { buildQuotePdf } from "./quote-pdf";

const quote: Quote = {
  intro: "vielen Dank für Ihre Anfrage – gern bieten wir Ihnen folgende Leistungen an:",
  items: [
    { title: "Dachziegel ersetzen (Satteldach) – inkl. Gerüst „klein“", qty: 10, unit: "m²", unitPrice: 45.5 },
    { title: "Anfahrt", qty: 1, unit: "pauschal", unitPrice: 39 },
  ],
  vatRate: 19,
  validDays: 30,
  number: "A-20261102-ABCD",
  sentAt: null,
};

describe("Angebot", () => {
  it("rechnet Netto, MwSt. und Gesamt", () => {
    expect(quoteTotals(quote)).toEqual({ net: 494, vat: 93.86, gross: 587.86, complete: true });
    expect(quoteTotals({ ...quote, vatRate: 0 }).gross).toBe(494);
    expect(quoteTotals({ ...quote, items: [{ ...quote.items[0], unitPrice: null }] }).complete).toBe(false);
  });

  it("liest gespeicherte Angebote robust", () => {
    expect(readQuote({ quote: JSON.stringify(quote) })?.items).toHaveLength(2);
    expect(readQuote({ quote: "kaputt" })).toBeNull();
    expect(readQuote({})).toBeNull();
    expect(quoteNumber("1234abcd-0000", new Date("2026-11-02T10:00:00Z"))).toBe("A-20261102-1234");
  });

  it("erzeugt ein PDF mit Umlauten und Euro-Zeichen", async () => {
    const pdf = await buildQuotePdf({
      company: { name: "Dachdeckerei Müller", address: "Hauptstraße 1, 80331 München", phone: "089 123", website: "", email: "info@mueller.de" },
      customer: { name: "Erika Größe", street: "Lindenweg 7", city: "80331 München" },
      service: "Sturmschaden",
      quote,
      date: new Date("2026-11-02T10:00:00Z"),
    });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });
});
