import { describe, expect, it } from "vitest";
import { cleanKnowledge, hasKnowledge, inventsPrice, knowledgeText } from "./knowledge";

const k = cleanKnowledge({
  prices: [
    { item: "Herrenschnitt", price: "25 €", note: "inkl. Waschen" },
    { item: "Energieausweis", price: "ab 299 €" },
    { item: "Ohne Preis", price: "" },
  ],
  faqs: [
    { q: "Haben Sie samstags geöffnet?", a: "Ja, samstags von 9 bis 14 Uhr." },
    { q: "Unbeantwortet", a: "" },
  ],
});

describe("Wissen & Preise", () => {
  it("behält nur vollständige Zeilen", () => {
    expect(k.prices.map((p) => p.item)).toEqual(["Herrenschnitt", "Energieausweis"]);
    expect(k.faqs).toHaveLength(1);
    expect(hasKnowledge(k)).toBe(true);
    expect(hasKnowledge(cleanKnowledge({}))).toBe(false);
  });

  it("enthält Preise und Antworten im Text für die KI", () => {
    const t = knowledgeText(k);
    expect(t).toContain("Herrenschnitt: 25 € (inkl. Waschen)");
    expect(t).toContain("samstags von 9 bis 14 Uhr");
  });

  it("lässt keine erfundenen Beträge durch", () => {
    expect(inventsPrice("Ein Herrenschnitt kostet bei uns 25 € inkl. Waschen.", k)).toBe(false);
    expect(inventsPrice("Der Energieausweis kostet ab 299 €.", k)).toBe(false);
    expect(inventsPrice("Ein Damenschnitt kostet 45 €.", k)).toBe(true);
    expect(inventsPrice("Beides zusammen kostet 324 Euro.", k)).toBe(true);
    expect(inventsPrice("Ja, samstags von 9 bis 14 Uhr.", k)).toBe(false);
  });
});
