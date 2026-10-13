import { describe, expect, it } from "vitest";
import { obviousHumanQuestion, withoutProcessQuestions } from "./personal-reply";

describe("withoutProcessQuestions", () => {
  it("entfernt Fragen zum Ablauf – die beantwortet die KI mit Nachricht und Formular", () => {
    for (const q of ["Welche Angaben benötigen Sie noch von mir?", "Wie läuft das bei Ihnen ab mit dem iSFP?", "Wie ist der Ablauf?", "Wie geht es jetzt weiter?"]) {
      expect(withoutProcessQuestions(q).trim()).toBe("");
    }
  });
  it("lässt echte Fragen stehen", () => {
    expect(withoutProcessQuestions("Was kostet ein iSFP?")).toContain("kostet");
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
