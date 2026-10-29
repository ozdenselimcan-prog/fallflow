import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import { assignMemoryNumber, phoneRepo } from "./calls";
import { e164, twiml, validTwilioSignature } from "./twilio";
import { callEnded, callTurn, incomingCall } from "./voice";

const NUMBER = "+4989111222";

beforeEach(() => {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  delete (globalThis as unknown as { __phoneDb?: unknown }).__phoneDb;
  createMemoryStore();
  assignMemoryNumber(NUMBER, "demo");
});

const said = (xml: string) => [...xml.matchAll(/<Say[^>]*>([^<]*)<\/Say>/g)].map((m) => m[1]).join(" ");

describe("Twilio-Bausteine", () => {
  it("prüft die Signatur", () => {
    const params = { CallSid: "CA1", From: "+491701234567", To: NUMBER };
    const url = "https://example.test/api/phone/voice";
    const sig = createHmac("sha1", "geheim").update(url + "CallSidCA1From+491701234567To" + NUMBER).digest("base64");
    expect(validTwilioSignature("geheim", url, params, sig)).toBe(true);
    expect(validTwilioSignature("geheim", url, { ...params, To: "+49000" }, sig)).toBe(false);
    expect(validTwilioSignature("geheim", url, params, null)).toBe(false);
  });
  it("baut gültiges TwiML und liest keine Links vor", () => {
    const xml = twiml([{ say: "Hallo & willkommen <b> https://x.de/a" }, { hangup: true }]);
    expect(xml).toContain("Hallo &amp; willkommen");
    expect(xml).not.toContain("https://");
    expect(xml).toContain("<Hangup/>");
  });
  it("bringt Nummern in E.164", () => {
    expect(e164("089 111222")).toBe("+4989111222");
    expect(e164("+49 89 111222")).toBe("+4989111222");
  });
});

describe("Telefon-Gespräch", () => {
  it("begrüßt mit KI-Hinweis und hört dann zu", async () => {
    const xml = await incomingCall({ callSid: "CA1", from: "+491701234567", to: NUMBER });
    expect(said(xml)).toMatch(/künstliche Intelligenz/);
    expect(xml).toContain("<Gather");
  });
  it("unbekannte Nummer: freundlich auflegen", async () => {
    const xml = await incomingCall({ callSid: "CA2", from: "+491701234567", to: "+4930999" });
    expect(xml).toContain("<Hangup/>");
  });
  it("fragt Fehlendes einzeln ab, nie nach der E-Mail-Adresse, und verabschiedet sich am Ende", async () => {
    await incomingCall({ callSid: "CA3", from: "+491701234567", to: NUMBER });
    let xml = await callTurn({ callSid: "CA3", from: "+491701234567", to: NUMBER, speech: "Hallo, mein Name ist Max Mustermann, ich hätte gern eine Energieberatung für mein Einfamilienhaus." });
    const answers: Record<string, string> = {
      Baujahr: "1998",
      Wohnfläche: "140 Quadratmeter",
      Heiz: "Gasheizung",
      Eigentümer: "Ich bin Eigentümer",
      Straße: "Musterstraße 1",
      Adresse: "Musterstraße 1",
      Postleitzahl: "80331",
      PLZ: "80331",
      Etagen: "2",
      Tage: "Montag bis Freitag",
      Wochentag: "Montag bis Freitag",
    };
    const asked: string[] = [];
    for (let i = 0; i < 14 && xml.includes("<Gather"); i++) {
      const q = said(xml);
      asked.push(q);
      const key = Object.keys(answers).find((k) => q.includes(k));
      xml = await callTurn({ callSid: "CA3", from: "+491701234567", to: NUMBER, speech: key ? answers[key] : "Weiß ich nicht" });
    }
    if (process.env.SHOW_DIALOG) throw new Error(`DIALOG: ${asked.join(" ||| ")} ||| ENDE: ${said(xml)}`);
    expect(asked.join(" ")).not.toMatch(/E-Mail-Adresse/);
    expect(xml).toContain("<Hangup/>");
    expect(said(xml)).toMatch(/Auf Wiederhören/);
    const call = await phoneRepo()!.getCall("CA3");
    expect(call?.caseId).toBeTruthy();
  });
  it("Notfall gleich zu Beginn: Team ruft zurück", async () => {
    await incomingCall({ callSid: "CA4", from: "+491701234567", to: NUMBER });
    const xml = await callTurn({ callSid: "CA4", from: "+491701234567", to: NUMBER, speech: "Hallo, was kostet bei Ihnen eigentlich ein Energieausweis?" });
    expect(said(xml)).toMatch(/rufen Sie so schnell wie möglich zurück/);
    expect(xml).toContain("<Hangup/>");
  });
  it("Stille: zweimal nachfragen, dann verabschieden", async () => {
    await incomingCall({ callSid: "CA5", from: "+491701234567", to: NUMBER });
    expect(await callTurn({ callSid: "CA5", from: "", to: NUMBER, speech: "", attempt: 0 })).toContain("<Gather");
    expect(await callTurn({ callSid: "CA5", from: "", to: NUMBER, speech: "", attempt: 2 })).toContain("<Hangup/>");
  });
  it("zählt die Minuten (angefangene Minute = volle Minute)", async () => {
    await incomingCall({ callSid: "CA6", from: "+491701234567", to: NUMBER });
    await callEnded({ callSid: "CA6", status: "completed", durationSec: 61 });
    expect(await phoneRepo()!.minutesThisMonth("demo")).toBe(2);
  });
});
