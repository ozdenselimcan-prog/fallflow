import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { dispatchDueFollowUps } from "./follow-ups";

function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

const yesterday = new Date(Date.now() - 86_400_000).toISOString();

describe("dispatchDueFollowUps", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("versucht die eigene Leistungs-Nachricht zu verschicken (nicht die generische Angaben-Checkliste), wenn noch nicht gesendet", async () => {
    // Im In-Memory-Store ist nie ein echter E-Mail-Kanal verbunden (kein Supabase konfiguriert) – der Versand
    // selbst schlaegt daher immer fehl ("manual"). Entscheidend fuer diesen Test: matchServiceMaterials wurde
    // ueberhaupt aufgerufen und hat etwas gefunden, statt direkt auf die generische Checkliste auszuweichen –
    // erkennbar an der spezifischen "kein Postfach verbunden"-Fehlermeldung statt der generischen "Warte auf
    // fehlende Angaben"-Notiz (siehe zweiter Test), UND an der neu angelegten Vorlagen-Versand-Spur im Ereignislog.
    await store.saveServiceMessage({ service: "Heizung", body: "Danke für Ihre Anfrage zum Hydraulischen Abgleich, wir melden uns." });
    const c = await store.createCase({ source: "email", status: "NEW", assignedTo: null, summary: "", fields: { service: "Heizung", email: "kunde@example.com" }, customerName: "Kunde", service: "Heizung" });
    await store.saveFollowUp({ caseId: c.id, kind: "info", message: "Alte generische Angaben-Checkliste, sollte NICHT verschickt werden.", scheduledFor: yesterday, status: "planned", sentAt: null, note: "" });

    const summary = await dispatchDueFollowUps(store);
    expect(summary).toMatchObject({ due: 1, manual: 1 });

    const [followUp] = await store.listFollowUps();
    expect(followUp.note).not.toContain("Warte auf fehlende Angaben");

    const events = await store.listEvents(c.id);
    expect(events.some((e) => e.type === "document" && e.text.includes("Nachricht automatisch an Kunden gesendet"))).toBe(true);

    const messages = await store.listMessages(c.id);
    expect(messages.some((m) => m.content.includes("Alte generische Angaben-Checkliste"))).toBe(false);
  });

  it("markiert als 'manuell' statt automatisch eine Angaben-Checkliste zu verschicken, wenn keine Leistung bekannt ist", async () => {
    const c = await store.createCase({ source: "email", status: "NEW", assignedTo: null, summary: "", fields: { email: "kunde2@example.com" }, customerName: "Kunde2", service: "" });
    await store.saveFollowUp({ caseId: c.id, kind: "info", message: "Alte generische Angaben-Checkliste, sollte NICHT verschickt werden.", scheduledFor: yesterday, status: "planned", sentAt: null, note: "" });

    const summary = await dispatchDueFollowUps(store);
    expect(summary).toMatchObject({ due: 1, sent: 0, manual: 1, cancelled: 0 });

    const messages = await store.listMessages(c.id);
    expect(messages.some((m) => m.role === "assistant")).toBe(false);
  });

  it("markiert als 'manuell', wenn die eigene Nachricht fuer diese Leistung bereits verschickt wurde", async () => {
    await store.saveServiceMessage({ service: "Heizung", body: "Danke für Ihre Anfrage." });
    const c = await store.createCase({
      source: "email",
      status: "NEW",
      assignedTo: null,
      summary: "",
      fields: { service: "Heizung", email: "kunde3@example.com", serviceMessageSentFor: "Heizung" },
      customerName: "Kunde3",
      service: "Heizung",
    });
    await store.saveFollowUp({ caseId: c.id, kind: "info", message: "Alte generische Angaben-Checkliste.", scheduledFor: yesterday, status: "planned", sentAt: null, note: "" });

    const summary = await dispatchDueFollowUps(store);
    expect(summary).toMatchObject({ due: 1, sent: 0, manual: 1, cancelled: 0 });
  });
});
