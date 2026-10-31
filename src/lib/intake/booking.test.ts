import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { bookByCustomer, bookingLinkEnabled, freeSlotsForBooking } from "./case-ops";
import { listFreeSlots } from "./scheduling";

beforeEach(() => {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
});

async function caseWithEmail(store: Store) {
  return store.createCase({ fields: { name: "Max Kunde", email: "max@example.com", service: "iSFP" }, customerName: "Max Kunde", service: "iSFP", source: "email", status: "COMPLETE", assignedTo: null, summary: "" });
}

describe("Buchungslink", () => {
  it("ist standardmäßig an und abschaltbar", async () => {
    const store = createMemoryStore();
    expect(await bookingLinkEnabled(store)).toBe(true);
    const c = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...c.businessProfile, automation: { bookingLink: false } } });
    expect(await bookingLinkEnabled(store)).toBe(false);
  });

  it("listet freie Termine nur an Arbeitstagen und ohne belegte Zeiten", () => {
    const from = new Date("2026-11-02T06:00:00Z"); // Montag
    const days = listFreeSlots({ workingDays: [1, 2], slotStart: "09:00", slotEnd: "12:00", slotMinutes: 60, existing: [{ startsAt: "2026-11-03T09:00:00Z", durationMin: 60 }], from }, { days: 3 });
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) expect([1, 2]).toContain(new Date(`${d.day}T12:00:00Z`).getUTCDay());
    expect(days.flatMap((d) => d.slots)).not.toContain("2026-11-03T09:00:00.000Z");
  });

  it("bucht einen freien Termin als Vorschlag – und lehnt belegte Zeiten ab", async () => {
    const store = createMemoryStore();
    const c = await caseWithEmail(store);
    const free = (await freeSlotsForBooking(store, c)).flatMap((d) => d.slots);
    expect(free.length).toBeGreaterThan(0);
    const r = await bookByCustomer(store, c, free[0]);
    expect(r).toEqual({ ok: true, confirmed: false });
    const appts = (await store.listAppointments()).filter((a) => a.caseId === c.id);
    expect(appts).toHaveLength(1);
    expect(appts[0].status).toBe("proposed");
    expect((await bookByCustomer(store, c, "2020-01-01T09:00:00.000Z")).ok).toBe(false);
  });

  it("Umbuchen ersetzt den bisherigen Termin; mit automatischer Bestätigung ist er sofort fest", async () => {
    const store = createMemoryStore();
    const company = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...company.businessProfile, automation: { autoConfirm: true } } });
    const c = await caseWithEmail(store);
    const free = (await freeSlotsForBooking(store, c)).flatMap((d) => d.slots);
    await bookByCustomer(store, c, free[0]);
    const r = await bookByCustomer(store, c, free[1]);
    expect(r).toEqual({ ok: true, confirmed: true });
    const appts = (await store.listAppointments()).filter((a) => a.caseId === c.id);
    expect(appts).toHaveLength(1);
    expect(appts[0].startsAt).toBe(free[1]);
    expect(appts[0].status).toBe("confirmed");
  });
});
