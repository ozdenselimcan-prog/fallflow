import { describe, expect, it } from "vitest";
import { DEFAULT_ASSISTANT } from "@/lib/cases/fields";
import { EMPTY_BUSINESS_PROFILE } from "@/lib/data/types";
import { parsePrices, SETUP_QUESTIONS, setupQuestion } from "./setup-questions";

const S = { assistant: { ...DEFAULT_ASSISTANT, workingDays: [1, 2, 3, 4, 5] }, profile: { ...EMPTY_BUSINESS_PROFILE, documents: ["Fotos vom Schaden"] } };

describe("Einrichtungs-Fragebogen", () => {
  it("jede Frage hat eine eindeutige id und stellt etwas ein", () => {
    expect(new Set(SETUP_QUESTIONS.map((q) => q.id)).size).toBe(SETUP_QUESTIONS.length);
    for (const q of SETUP_QUESTIONS) {
      expect(Object.keys(q.apply("yes", "", S)).length).toBeGreaterThan(0);
      expect(Object.keys(q.apply("no", "", S)).length).toBeGreaterThan(0);
    }
  });

  it("übersetzt Antworten in Einstellungen", () => {
    expect(setupQuestion("bookingLink")!.apply("no", "", S)).toEqual({ automation: { bookingLink: false } });
    expect(setupQuestion("onSite")!.apply("no", "", S)).toEqual({ needsAddress: false });
    expect(setupQuestion("emergency")!.apply("no", "", S)).toEqual({ texts: { "email.urgentPhone": "-" } });
    expect(setupQuestion("emergency")!.apply("yes", "In dringenden Fällen erreichen Sie uns werktags bis 20 Uhr unter {telefon}.", S).texts!["email.urgentPhone"]).toContain("20 Uhr");
    expect(setupQuestion("emergency")!.apply("yes", "In dringenden Fällen erreichen Sie uns werktags bis 20 Uhr telefonisch.", S).texts!["email.urgentPhone"]).toBe("In dringenden Fällen erreichen Sie uns werktags bis 20 Uhr telefonisch unter {telefon}.");
    expect(setupQuestion("signoff")!.apply("no", "", S)).toEqual({ texts: { "email.signoff": "Mit freundlichen Grüßen\n{firma}" } });
    expect(setupQuestion("greeting")!.apply("no", "", S)).toEqual({ texts: { "email.greeting": "Hallo {name}," } });
    expect(setupQuestion("notifyReady")!.apply("yes", "buero@firma.de", S)).toEqual({ assistant: { notifyReady: true, notifyEmail: "buero@firma.de" } });
  });

  it("Bewertungen nur mit gültigem Link", () => {
    expect(setupQuestion("reviews")!.apply("yes", "", S)).toEqual({ automation: { reviews: false } });
    expect(setupQuestion("reviews")!.apply("yes", "https://g.page/r/abc/review", S)).toEqual({ automation: { reviews: true, reviewLink: "https://g.page/r/abc/review" } });
  });
});

describe("Testphase", () => {
  it("nur Starter darf kostenlos getestet werden", async () => {
    const { planHasTrial } = await import("./pricing");
    expect(planHasTrial("starter")).toBe(true);
    expect(planHasTrial("pro")).toBe(false);
    expect(planHasTrial("business")).toBe(false);
    expect(planHasTrial(undefined)).toBe(true);
  });
});

describe("Fragebogen: Termine, Preise und Wissen", () => {
  it("Samstag, Dauer und Termine pro Tag", () => {
    expect(setupQuestion("saturday")!.apply("yes", "", S)).toEqual({ assistant: { workingDays: [1, 2, 3, 4, 5, 6] } });
    expect(setupQuestion("duration")!.apply("no", "30 Minuten", S)).toEqual({ assistant: { slotMinutes: 30 } });
    expect(setupQuestion("duration")!.apply("no", "", S)).toEqual({ assistant: { slotMinutes: 120 } });
    expect(setupQuestion("maxPerDay")!.apply("yes", "2", S)).toEqual({ assistant: { maxAppointmentsPerDay: 2 } });
    expect(setupQuestion("maxPerDay")!.apply("no", "", S)).toEqual({ assistant: { maxAppointmentsPerDay: null } });
  });

  it("Preise und häufige Fragen landen in „Wissen & Preise“", () => {
    expect(parsePrices("Anfahrt 39 €; Stundensatz = 55 € pro Stunde\nEntsorgung: ab 80 EUR")).toEqual([
      { item: "Anfahrt", price: "39 €" },
      { item: "Stundensatz", price: "55 € pro Stunde" },
      { item: "Entsorgung", price: "ab 80 EUR" },
    ]);
    expect(setupQuestion("hours")!.apply("yes", "Mo–Fr 8–17 Uhr", S)).toEqual({ faq: { q: "Wann sind Sie erreichbar?", a: "Mo–Fr 8–17 Uhr" } });
    expect(setupQuestion("hours")!.apply("no", "", S)).toEqual({ faq: { q: "Wann sind Sie erreichbar?", a: null } });
    expect(setupQuestion("freeEstimate")!.apply("yes", "", S).faq!.a).toMatch(/^Ja/);
    expect(setupQuestion("smallBusiness")!.apply("yes", "", S)).toEqual({ quoteVatRate: 0 });
    expect(setupQuestion("photos")!.current(S)).toBe("yes");
  });
});
