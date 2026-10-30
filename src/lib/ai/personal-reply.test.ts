import { describe, expect, it } from "vitest";
import { customerQuestion, obviousHumanQuestion, withoutProcessQuestions } from "./personal-reply";

describe("withoutProcessQuestions", () => {
  it("entfernt Fragen zum Ablauf – die beantwortet die KI mit Nachricht und Formular", () => {
    for (const q of ["Welche Angaben benötigen Sie noch von mir?", "Wie läuft das bei Ihnen ab mit dem iSFP?", "Wie ist der Ablauf?", "Wie geht es jetzt weiter?"]) {
      expect(withoutProcessQuestions(q).trim()).toBe("");
    }
  });
  it("lässt echte Fragen stehen", () => {
    expect(withoutProcessQuestions("Was kostet ein iSFP?")).toContain("kostet");
  });
  it("entfernt als Frage formulierte Bitten um die Leistung – das ist eine Anfrage", () => {
    for (const q of ["Können Sie sich das ansehen?", "Könnten Sie das bitte reparieren?", "Können Sie vorbeikommen und den Schaden beheben?", "Können Sie uns helfen?"]) {
      expect(withoutProcessQuestions(q).trim()).toBe("");
    }
    const mail = "Nach dem Sturm fehlen einige Ziegel auf dem Dach. Können Sie sich das ansehen?";
    expect(withoutProcessQuestions(mail)).not.toContain("?");
  });
  it("Bitte mit Preis- oder Zeitfrage bleibt eine Frage", () => {
    expect(withoutProcessQuestions("Können Sie das reparieren und was kostet das?")).toContain("kostet");
    expect(withoutProcessQuestions("Können Sie das bis Freitag reparieren? Wie lange dauert das?")).toContain("Wie lange");
  });
});

describe("obviousHumanQuestion", () => {
  it("Preis- und Förderfragen gehen an das Büro", () => {
    expect(obviousHumanQuestion("Was kostet bei Ihnen ein Energieausweis?")).toBeTruthy();
    expect(obviousHumanQuestion("Bekomme ich dafür eine Förderung?")).toBeTruthy();
  });
});

describe("obviousHumanQuestion – Fragen zur Form von Unterlagen", () => {
  it("gehen an das Büro", () => {
    expect(obviousHumanQuestion("Reicht Ihnen ein Foto vom Grundriss oder brauchen Sie das Original?")).toBeTruthy();
    expect(obviousHumanQuestion("Kann ich das Formular auch handschriftlich ausfüllen?")).toBeTruthy();
    expect(obviousHumanQuestion("Muss ich das unterschreiben?")).toBeTruthy();
  });
  it("Angaben ohne Frage bleiben unberührt", () => {
    expect(obviousHumanQuestion("Anbei das unterschriebene Formular.")).toBeNull();
  });
});

describe("customerQuestion – Terminfragen", () => {
  const business = { industry: "Elektroinstallation", humanTopics: ["Preise"] };
  it("nur nach einem freien Termin gefragt: der Betrieb antwortet selbst", async () => {
    expect(await customerQuestion("Hallo, wann habt ihr einen Termin frei?\nGruß Jonas Wagner", business)).toBeTruthy();
    expect(await customerQuestion("Guten Tag, wann hätten Sie Zeit für eine Wallbox-Installation?\nViele Grüße\nJonas Wagner, 0171 2345678", business)).toBeTruthy();
  });
  it("Anliegen genannt und nach Termin gefragt: normal beantworten", async () => {
    expect(await customerQuestion("Hallo, wir möchten eine Wallbox in unserer Garage installieren lassen, 11 kW. Wann hätten Sie Zeit?\nViele Grüße Jonas Wagner", business)).toBeNull();
    expect(await customerQuestion("Wir brauchen eine neue Unterverteilung, wann könnt ihr vorbeikommen?", business)).toBeNull();
  });
  it("Preisfrage bleibt eine Frage, auch neben einer Terminfrage", async () => {
    expect(await customerQuestion("Wir möchten eine Wallbox installieren lassen. Was kostet das und wann hätten Sie Zeit?", business)).toBeTruthy();
  });
});
