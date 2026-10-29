import { beforeEach, describe, expect, it } from "vitest";
import { splitAddress } from "@/lib/ai/conversation";
import { normalizeWhatsAppQuestions } from "@/lib/ai/whatsapp-questions";
import { createMemoryStore } from "@/lib/data/memory";
import { routeInbound } from "./router";

beforeEach(() => {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
});

describe("WhatsApp-Fragen", () => {
  it("übernimmt bekannte Schlüssel, vergibt sonst eigene und filtert unbekannte Leistungen", () => {
    const list = normalizeWhatsAppQuestions(
      [
        { key: "postalCode", label: "PLZ", prompt: "Wie lautet Ihre Postleitzahl?", services: [] },
        { key: "", label: "Schadensfläche", prompt: "Wie groß ist der Schaden ungefähr?", services: ["Dachreparatur", "Gibtsnicht"] },
        { key: "", label: "Schadensfläche", prompt: "doppelt", services: [] },
        { key: "", label: "", prompt: "" },
      ],
      ["Dachreparatur", "Neueindeckung"],
      ["postalCode", "street"],
    );
    // Nur die PLZ reicht nicht: daraus wird die Frage nach der ganzen Adresse.
    expect(list.map((q) => q.key)).toEqual(["street", "waSchadensflaeche"]);
    expect(list[0].prompt).toMatch(/Straße, Hausnummer, PLZ und Ort/);
    expect(list[1].services).toEqual(["Dachreparatur"]);
  });

  it("mit eigener Liste fragt WhatsApp nur diese Fragen – E-Mail bleibt wie bisher", async () => {
    const store = createMemoryStore();
    const company = await store.getCompany();
    await store.updateCompany({
      businessProfile: {
        ...company.businessProfile,
        industry: "Energieberatung",
        whatsappQuestions: [
          { key: "postalCode", label: "PLZ", prompt: "Wie lautet Ihre Postleitzahl?", services: [] },
          { key: "waWunsch", label: "Wunschtermin", prompt: "Wann würde es Ihnen am besten passen?", services: [] },
        ],
      },
    });
    const sender = { phone: "+491765550077", name: "Erika" };
    const r1 = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Hallo, ich hätte gern eine Energieberatung.", sender });
    const id = r1.turn.sessionId;
    const lastBot = async () => (await store.listMessages(id)).filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    expect(await lastBot()).toContain("Wie lautet Ihre Postleitzahl?");
    await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "80331", sender });
    expect(await lastBot()).toContain("Wann würde es Ihnen am besten passen?");
    await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Nächste Woche vormittags", sender });
    const all = (await store.listMessages(id)).map((m) => m.content).join(" ");
    // Energieberatungs-Standardfragen (Baujahr, Heizung …) kommen bei WhatsApp nicht mehr.
    expect(all).not.toMatch(/Baujahr|Heizung|Wohnfläche/);
    const c = await store.getCase(id);
    expect(c?.fields.postalCode).toBe("80331");
    expect(c?.fields.waWunsch).toBe("Nächste Woche vormittags");
    expect(c?.status).toBe("READY_FOR_REVIEW");
  });
});

describe("Adresse in einer Antwort", () => {
  it("trennt Straße, PLZ und Ort", () => {
    expect(splitAddress("Lindenweg 7, 82166 Gräfelfing")).toEqual({ street: "Lindenweg 7", postalCode: "82166", city: "Gräfelfing" });
    expect(splitAddress("Am Bach 12a 70565 Stuttgart")).toEqual({ street: "Am Bach 12a", postalCode: "70565", city: "Stuttgart" });
    expect(splitAddress("80331 München, Musterstraße 1")).toEqual({ street: "Musterstraße 1", postalCode: "80331", city: "München" });
    expect(splitAddress("Musterstraße 1")).toEqual({ street: "Musterstraße 1", postalCode: "", city: "" });
  });
});
