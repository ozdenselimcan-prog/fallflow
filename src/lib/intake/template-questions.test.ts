import { beforeEach, describe, expect, it } from "vitest";
import { normalizeTemplateQuestions } from "@/lib/ai/template-questions";
import { createMemoryStore } from "@/lib/data/memory";
import { routeInbound } from "./router";

beforeEach(() => {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
});

describe("Fragen aus PDF-Formularen", () => {
  it("lässt Kontaktdaten, Datum und Unterschrift weg und bildet eindeutige Schlüssel", () => {
    const qs = normalizeTemplateQuestions(
      {
        questions: [
          { label: "Name", prompt: "Wie heißen Sie?" },
          { label: "Art der Arbeiten", prompt: "Welche Arbeiten sollen gemacht werden?" },
          { label: "Gewünschter Zeitraum", prompt: "" },
          { label: "Unterschrift", prompt: "?" },
          { label: "Art der Arbeiten", prompt: "doppelt" },
        ],
      },
      "eedaeaef-33ce-4934",
    );
    expect(qs.map((q) => q.label)).toEqual(["Art der Arbeiten", "Gewünschter Zeitraum"]);
    expect(qs[0].key).toBe("feedaeaArtDerArbeiten");
    expect(qs[1].prompt).toBe("Gewünschter Zeitraum?");
  });

  it("WhatsApp: fragt die Formular-Angaben einzeln ab, statt das PDF zu schicken", async () => {
    const store = createMemoryStore();
    const tpl = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Auftragsformular", fileName: "auftrag.pdf", storagePath: "demo/templates/auftrag.pdf" });
    const company = await store.getCompany();
    await store.updateCompany({
      businessProfile: { ...company.businessProfile, templateQuestions: { [tpl.id]: [{ key: "fxArtDerArbeiten", label: "Art der Arbeiten", prompt: "Welche Arbeiten sollen gemacht werden?" }] } },
    });
    const sender = { phone: "+491765550001", name: "Erika Beispiel" };
    let r = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Hallo, ich hätte gern eine Energieberatung für unser Einfamilienhaus.", sender });
    const id = r.turn.sessionId;
    // Alle Fragen beantworten, bis die Formular-Frage kommt.
    const answers: Record<string, string> = { Baujahr: "1998", Wohnfläche: "140", Heizung: "Gas", Eigentümer: "Eigentümer", Adresse: "Musterstraße 1", Straße: "Musterstraße 1", Postleitzahl: "80331", Etagen: "2", Arbeiten: "Dämmung des Dachs" };
    let asked = "";
    for (let i = 0; i < 12; i++) {
      const last = (await store.listMessages(id)).filter((m) => m.role === "assistant").at(-1)?.content ?? "";
      asked += ` ${last}`;
      if (last.includes("Welche Arbeiten")) break;
      const key = Object.keys(answers).find((k) => last.includes(k));
      r = await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: key ? answers[key] : "Weiß ich nicht", sender });
    }
    expect(asked).toContain("Welche Arbeiten sollen gemacht werden?");
    expect(asked).not.toMatch(/Formular aus|herunterladen|\/api\/upload/);
    expect(await store.listTemplateDocuments(id)).toHaveLength(0);
    await routeInbound(store, { companyId: "demo", channel: "whatsapp", text: "Dämmung des Dachs", sender });
    expect((await store.getCase(id))?.fields.fxArtDerArbeiten).toBe("Dämmung des Dachs");
  });
});
