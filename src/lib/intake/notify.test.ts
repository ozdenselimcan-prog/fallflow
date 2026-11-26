import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { processIntakeMessage } from "./engine";

vi.mock("@/lib/integrations/outbound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/outbound")>();
  return { ...actual, deliverToCustomer: vi.fn(async () => ({ delivered: true, reason: "" })) };
});

function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

const email = (store: Store, text: string) =>
  processIntakeMessage(store, { companyId: "demo", sessionId: null, text, source: "email", channel: "email", identity: { email: "kunde@example.com", name: "Max Kunde" } });

const officeMails = () => vi.mocked(deliverToCustomer).mock.calls.map(([input]) => input).filter((i) => i.subject?.startsWith("FallFlow:"));

describe("Benachrichtigung an das Büro", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
    vi.mocked(deliverToCustomer).mockClear();
  });

  it("bei 'Aufmerksamkeit benötigt' geht eine Mail an das Büro (eigene Empfänger-Adresse)", async () => {
    await store.saveAssistant({ ...(await store.getAssistant()), notifyEmail: "buero@muster.de" });
    await email(store, "Hallo, ich möchte einen iSFP. Was kostet das bei Ihnen?");
    const mails = officeMails();
    expect(mails).toHaveLength(1);
    expect(mails[0].email).toBe("buero@muster.de");
    expect(mails[0].subject).toBe("FallFlow: Max Kunde wartet auf Ihre Antwort");
    expect(mails[0].text).toContain("/dashboard/cases/");
  });

  it("ausgeschaltet: keine Mail", async () => {
    await store.saveAssistant({ ...(await store.getAssistant()), notifyAttention: false, notifyEmail: "buero@muster.de" });
    await email(store, "Hallo, ich möchte einen iSFP. Was kostet das bei Ihnen?");
    expect(officeMails()).toHaveLength(0);
  });

  it("fertig vorbereiteter Fall: Mail 'bereit zur Prüfung'", async () => {
    await store.saveAssistant({ ...(await store.getAssistant()), notifyEmail: "buero@muster.de" });
    await store.saveServiceMessage({ service: "Fördermittelberatung", body: "Danke!", appointmentNote: "", requiresFloorplan: false, requiresEnergyCertificate: false });
    await email(store, "Hallo, ich möchte eine Fördermittelberatung für mein Haus.");
    const mails = officeMails();
    expect(mails.some((m) => m.subject === "FallFlow: Fall bereit zur Prüfung – Max Kunde (Fördermittelberatung)")).toBe(true);
  });
});

describe("Notfall-Mail an das Büro", () => {
  it("geht immer raus – auch wenn Benachrichtigungen ausgeschaltet sind – mit Telefon und Nachricht", async () => {
    const store = freshStore();
    vi.mocked(deliverToCustomer).mockClear();
    await store.saveAssistant({ ...(await store.getAssistant()), notifyAttention: false, notifyEmail: "buero@muster.de" });
    const c = await store.createCase({
      fields: { name: "Erika Beispiel", email: "erika@beispiel.de", phone: "0151 1234567", street: "Lindenweg 7, 82166 Gräfelfing", needsAttention: "Frage des Kunden: Notfall: Wasser läuft ins Haus" },
      customerName: "Erika Beispiel",
      service: "",
      source: "email",
      status: "NEEDS_REPLY",
      assignedTo: null,
      summary: "",
    });
    await store.addMessage(c.id, "user", "Hilfe, seit dem Sturm läuft Wasser durch die Decke!", { channel: "email", simulated: false, delivery: "delivered" });
    const { notifyOffice } = await import("./notify");
    await notifyOffice(store, c, "attention");
    const mails = vi.mocked(deliverToCustomer).mock.calls.map(([i]) => i).filter((i) => i.subject?.startsWith("NOTFALL"));
    expect(mails).toHaveLength(1);
    expect(mails[0].email).toBe("buero@muster.de");
    expect(mails[0].subject).toBe("NOTFALL: Erika Beispiel – bitte sofort melden");
    expect(mails[0].text).toContain("Telefon: 0151 1234567");
    expect(mails[0].text).toContain("Adresse: Lindenweg 7, 82166 Gräfelfing");
    expect(mails[0].text).toContain("läuft Wasser durch die Decke");
  });

  it("im Simulator: keine Notfall-Mail", async () => {
    const store = freshStore();
    vi.mocked(deliverToCustomer).mockClear();
    const c = await store.createCase({ fields: { name: "Test", needsAttention: "Frage des Kunden: Notfall: Gasgeruch" }, customerName: "Test", service: "", source: "email", status: "NEEDS_REPLY", assignedTo: null, summary: "" });
    await store.addMessage(c.id, "user", "Es riecht nach Gas", { channel: "email", simulated: true, delivery: "delivered" });
    const { notifyOffice } = await import("./notify");
    await notifyOffice(store, c, "attention");
    expect(vi.mocked(deliverToCustomer).mock.calls.filter(([i]) => i.subject?.startsWith("NOTFALL"))).toHaveLength(0);
  });
});
