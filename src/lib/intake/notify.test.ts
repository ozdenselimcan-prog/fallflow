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
