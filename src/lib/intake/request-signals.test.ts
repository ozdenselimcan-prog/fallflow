import { describe, expect, it } from "vitest";
import { formNotByEmail, looksLikeAutoReply, looksLikeWithdrawal, mentionedServices, requestsUntrackedItems } from "./request-signals";

const services = ["Energieausweis", "iSFP", "Fördermittelberatung", "Heizlastberechnung"];

describe("mentionedServices", () => {
  it("erkennt mehrere Leistungen, auch mit anderen Bezeichnungen", () => {
    expect(mentionedServices("Ich brauche einen Energieausweis und außerdem einen iSFP.", services)).toEqual(["Energieausweis", "iSFP"]);
    expect(mentionedServices("Wir wollen einen Sanierungsfahrplan und eine Heizlastberechnung", services)).toEqual(["iSFP", "Heizlastberechnung"]);
  });
  it("ignoriert verneinte Leistungen", () => {
    expect(mentionedServices("Ich brauche keinen iSFP, nur einen Energieausweis.", services)).toEqual(["Energieausweis"]);
  });
  it("eine Leistung = eine", () => {
    expect(mentionedServices("Hallo, ich möchte einen iSFP für mein Haus.", services)).toEqual(["iSFP"]);
  });
});

describe("formNotByEmail", () => {
  it("erkennt Post und fehlenden Drucker", () => {
    expect(formNotByEmail("Ich habe Ihnen das Formular heute per Post geschickt.")).toBe(true);
    expect(formNotByEmail("Ich habe keinen Drucker, deshalb die Angaben hier")).toBe(true);
  });
  it("normale Antworten nicht", () => {
    expect(formNotByEmail("Anbei das ausgefüllte Formular.")).toBe(false);
  });
});

describe("requestsUntrackedItems", () => {
  it("Heizkostenabrechnungen sind eine eigene Anforderung", () => {
    expect(requestsUntrackedItems("Vielen Dank! Für den Verbrauchsausweis brauchen wir die Heizkostenabrechnungen der letzten drei Jahre.")).toBe(true);
  });
  it("nur das Formular im Anhang oder bekannte Angaben zählen nicht", () => {
    expect(requestsUntrackedItems("Vielen Dank! Bitte füllen Sie das Formular im Anhang aus und senden Sie es uns zurück.")).toBe(false);
    expect(requestsUntrackedItems("Bitte nennen Sie uns noch Ihre Telefonnummer.")).toBe(false);
    expect(requestsUntrackedItems("Vielen Dank für Ihre Anfrage, wir melden uns.")).toBe(false);
  });
});

describe("mentionedServices – Energieausweis als Dokument", () => {
  it("ein vorhandener Energieausweis ist keine zweite Leistung", () => {
    expect(mentionedServices("Ich möchte einen iSFP, einen alten Energieausweis haben wir schon.", services)).toEqual(["iSFP"]);
    expect(mentionedServices("Anbei unser Energieausweis von 2015, wir möchten einen Sanierungsfahrplan.", services)).toEqual(["iSFP"]);
  });
});

describe("looksLikeWithdrawal / looksLikeAutoReply", () => {
  it("erkennt Rückzug", () => {
    expect(looksLikeWithdrawal("Hat sich erledigt, wir verkaufen doch nicht. Danke trotzdem!")).toBe(true);
    expect(looksLikeWithdrawal("Anbei das Formular, danke!")).toBe(false);
  });
  it("erkennt Abwesenheitsnotizen", () => {
    expect(looksLikeAutoReply("Abwesend: Re: Energieausweis", "Vielen Dank für Ihre Nachricht.")).toBe(true);
    expect(looksLikeAutoReply("Re: iSFP", "Vielen Dank für Ihre Nachricht. Ich bin bis zum 30.10. im Urlaub und lese meine E-Mails nicht.")).toBe(true);
    expect(looksLikeAutoReply("Re: iSFP", "Anbei die Unterlagen, ich bin nächste Woche im Urlaub.")).toBe(false);
  });
});
