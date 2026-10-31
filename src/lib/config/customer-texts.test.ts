import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import { frameEmail } from "@/lib/intake/case-ops";
import { CUSTOMER_TEXTS, cleanTexts, customerText, fillText, hasGreeting, hasSignoff } from "./customer-texts";

beforeEach(() => {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
});

describe("Kundentexte", () => {
  it("haben eindeutige Schlüssel und nur erklärte Platzhalter", () => {
    expect(new Set(CUSTOMER_TEXTS.map((t) => t.key)).size).toBe(CUSTOMER_TEXTS.length);
    for (const t of CUSTOMER_TEXTS) {
      const used = [...t.default.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const v of used) expect(t.vars).toContain(v);
    }
  });

  it("ersetzt Platzhalter und räumt fehlende Werte auf", () => {
    expect(fillText("Guten Tag {name},", { name: "Frau Lehmann" })).toBe("Guten Tag Frau Lehmann,");
    expect(fillText("Guten Tag {name},", {})).toBe("Guten Tag,");
  });

  it("eigene Fassung vor Standard, „-“ schaltet ab", () => {
    expect(customerText(undefined, "email.greeting", { name: "Max" })).toBe("Guten Tag Max,");
    expect(customerText({ "email.greeting": "Hallo {name}!" }, "email.greeting", { name: "Max" })).toBe("Hallo Max!");
    expect(customerText({ "email.signoff": "-" }, "email.signoff", { firma: "X" })).toBe("");
  });

  it("speichert nur bekannte Schlüssel und echte Änderungen", () => {
    const def = CUSTOMER_TEXTS.find((t) => t.key === "email.complete")!.default;
    expect(cleanTexts({ "email.complete": def, "email.signoff": "Beste Grüße\n{firma}", "gibtsnicht": "x", "chat.intro": "  " })).toEqual({ "email.signoff": "Beste Grüße\n{firma}" });
  });

  it("erkennt vorhandene Anrede und Gruß", () => {
    expect(hasGreeting("Hallo Herr Müller, danke")).toBe(true);
    expect(hasGreeting("Vielen Dank für Ihre Anfrage")).toBe(false);
    expect(hasSignoff("…\n\nViele Grüße\nIhr Team")).toBe(true);
    expect(hasSignoff("Vielen Dank für Ihre Anfrage")).toBe(false);
  });

  it("rahmt E-Mails mit Anrede und Gruß – eigene Fassungen und vorhandener Gruß werden beachtet", async () => {
    const store = createMemoryStore();
    const company = await store.getCompany();
    const framed = await frameEmail(store, "Vielen Dank für Ihre Anfrage.", "Frau Lehmann");
    expect(framed).toBe(`Guten Tag Frau Lehmann,\n\nvielen Dank für Ihre Anfrage.\n\nViele Grüße\n${company.name}`);
    expect(await frameEmail(store, "Hallo! Danke.\n\nBeste Grüße\nTeam", "X")).toBe("Hallo! Danke.\n\nBeste Grüße\nTeam");
    await store.updateCompany({ businessProfile: { ...company.businessProfile, texts: { "email.greeting": "-", "email.signoff": "Ihr Team von {firma}" } } });
    expect(await frameEmail(store, "vielen Dank.", "X")).toBe(`Vielen Dank.\n\nIhr Team von ${company.name}`);
  });
});
