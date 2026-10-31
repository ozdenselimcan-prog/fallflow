import { describe, expect, it } from "vitest";
import { SETUP_QUESTIONS, setupQuestion } from "./setup-questions";

describe("Einrichtungs-Fragebogen", () => {
  it("jede Frage hat eine eindeutige id und stellt etwas ein", () => {
    expect(new Set(SETUP_QUESTIONS.map((q) => q.id)).size).toBe(SETUP_QUESTIONS.length);
    for (const q of SETUP_QUESTIONS) {
      expect(Object.keys(q.apply("yes", "")).length).toBeGreaterThan(0);
      expect(Object.keys(q.apply("no", "")).length).toBeGreaterThan(0);
    }
  });

  it("übersetzt Antworten in Einstellungen", () => {
    expect(setupQuestion("bookingLink")!.apply("no", "")).toEqual({ automation: { bookingLink: false } });
    expect(setupQuestion("onSite")!.apply("no", "")).toEqual({ needsAddress: false });
    expect(setupQuestion("emergency")!.apply("no", "")).toEqual({ texts: { "email.urgentPhone": "-" } });
    expect(setupQuestion("emergency")!.apply("yes", "In dringenden Fällen erreichen Sie uns werktags bis 20 Uhr unter {telefon}.").texts!["email.urgentPhone"]).toContain("20 Uhr");
    expect(setupQuestion("emergency")!.apply("yes", "In dringenden Fällen erreichen Sie uns werktags bis 20 Uhr telefonisch.").texts!["email.urgentPhone"]).toBe("In dringenden Fällen erreichen Sie uns werktags bis 20 Uhr telefonisch unter {telefon}.");
    expect(setupQuestion("signoff")!.apply("no", "")).toEqual({ texts: { "email.signoff": "Mit freundlichen Grüßen\n{firma}" } });
    expect(setupQuestion("greeting")!.apply("no", "")).toEqual({ texts: { "email.greeting": "Hallo {name}," } });
    expect(setupQuestion("notifyReady")!.apply("yes", "buero@firma.de")).toEqual({ assistant: { notifyReady: true, notifyEmail: "buero@firma.de" } });
  });

  it("Bewertungen nur mit gültigem Link", () => {
    expect(setupQuestion("reviews")!.apply("yes", "")).toEqual({ automation: { reviews: false } });
    expect(setupQuestion("reviews")!.apply("yes", "https://g.page/r/abc/review")).toEqual({ automation: { reviews: true, reviewLink: "https://g.page/r/abc/review" } });
  });
});
