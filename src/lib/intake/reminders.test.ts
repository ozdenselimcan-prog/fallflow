import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { CaseRecord } from "@/lib/data/types";
import { apptReminderDue, dueReminder, isDaytimeInGermany, reviewDue, sendAppointmentReminders, sendReminders, sendReviewRequests } from "./reminders";

beforeEach(() => {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
});

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-03T10:00:00Z"); // 11 Uhr in Deutschland
const waiting = (fields: Record<string, string> = {}) => ({ status: "WAITING_FOR_CUSTOMER", source: "email", fields: { email: "k@example.com", ...fields } }) as unknown as CaseRecord;
const msg = (role: string, daysAgo: number) => ({ role, createdAt: new Date(now.getTime() - daysAgo * DAY).toISOString() });

describe("Erinnerungen", () => {
  it("nach 2 Tagen die erste, 3 Tage später die zweite, danach „keine Rückmeldung“", () => {
    expect(dueReminder(waiting(), msg("assistant", 1), now)).toBeNull();
    expect(dueReminder(waiting(), msg("assistant", 2), now)).toBe("first");
    expect(dueReminder(waiting({ reminderCount: "1" }), msg("assistant", 2), now)).toBeNull();
    expect(dueReminder(waiting({ reminderCount: "1" }), msg("assistant", 3), now)).toBe("second");
    expect(dueReminder(waiting({ reminderCount: "2" }), msg("assistant", 5), now)).toBe("noResponse");
  });

  it("nicht, wenn der Kunde zuletzt geschrieben hat, der Fall beim Büro liegt oder per WhatsApp kam", () => {
    expect(dueReminder(waiting(), msg("user", 4), now)).toBeNull();
    expect(dueReminder(waiting({ needsAttention: "Frage des Kunden: …" }), msg("assistant", 4), now)).toBeNull();
    expect(dueReminder({ ...waiting(), source: "whatsapp" } as CaseRecord, msg("assistant", 4), now)).toBeNull();
    expect(dueReminder({ ...waiting(), status: "READY_FOR_REVIEW" } as CaseRecord, msg("assistant", 4), now)).toBeNull();
  });

  it("nur tagsüber", () => {
    expect(isDaytimeInGermany(new Date("2026-11-03T10:00:00Z"))).toBe(true);
    expect(isDaytimeInGermany(new Date("2026-11-03T03:00:00Z"))).toBe(false);
  });

  it("abschaltbar über die Automatik-Einstellung", async () => {
    const store = createMemoryStore();
    const company = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...company.businessProfile, automation: { reminders: false } } });
    expect(await sendReminders(store, now)).toBe(0);
  });
});

describe("Bitte um Bewertung", () => {
  const appt = (hoursAgo: number, status = "confirmed") => ({ startsAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(), durationMin: 60, status });
  const c = (fields: Record<string, string> = {}) => ({ fields: { email: "k@example.com", ...fields } });

  it("am Tag nach einem bestätigten Termin, einmal, höchstens eine Woche danach", () => {
    expect(reviewDue(appt(10), c(), now)).toBe(false);
    expect(reviewDue(appt(22), c(), now)).toBe(true);
    expect(reviewDue(appt(24 * 9), c(), now)).toBe(false);
    expect(reviewDue(appt(22, "proposed"), c(), now)).toBe(false);
    expect(reviewDue(appt(22), c({ reviewAsked: "1" }), now)).toBe(false);
    expect(reviewDue(appt(22), { fields: {} }, now)).toBe(false);
  });

  it("nur eingeschaltet und mit Bewertungslink – dann genau einmal", async () => {
    const store = createMemoryStore();
    for (const a of await store.listAppointments()) await store.deleteAppointment(a.id);
    const k = await store.createCase({ fields: { name: "Max Kunde", email: "max@example.com", service: "Dach" }, customerName: "Max Kunde", service: "Dach", source: "email", status: "CONVERTED", assignedTo: null, summary: "" });
    await store.saveAppointment({ caseId: k.id, title: "Termin", startsAt: appt(22).startsAt, durationMin: 60, notes: "", status: "confirmed" });
    expect(await sendReviewRequests(store, now)).toBe(0);
    const company = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...company.businessProfile, automation: { reviews: true, reviewLink: "https://g.page/r/test/review" } } });
    expect(await sendReviewRequests(store, now)).toBe(1);
    expect((await store.listMessages(k.id)).at(-1)?.content).toContain("https://g.page/r/test/review");
    expect(await sendReviewRequests(store, now)).toBe(0);
  });
});

describe("Terminerinnerung am Vortag", () => {
  const tomorrow = { startsAt: "2026-11-04T09:00:00Z", status: "confirmed" };
  const c = (fields: Record<string, string> = {}) => ({ fields: { email: "k@example.com", ...fields } });

  it("nur für bestätigte Termine morgen, einmal je Termin", () => {
    expect(apptReminderDue(tomorrow, c(), now)).toBe(true);
    expect(apptReminderDue({ ...tomorrow, startsAt: "2026-11-05T09:00:00Z" }, c(), now)).toBe(false);
    expect(apptReminderDue({ ...tomorrow, status: "proposed" }, c(), now)).toBe(false);
    expect(apptReminderDue(tomorrow, c({ apptReminded: tomorrow.startsAt }), now)).toBe(false);
    expect(apptReminderDue(tomorrow, c({ apptReminded: "2026-11-02T09:00:00Z" }), now)).toBe(true);
  });

  it("sendet einmal und ist abschaltbar", async () => {
    const store = createMemoryStore();
    for (const a of await store.listAppointments()) await store.deleteAppointment(a.id);
    const k = await store.createCase({ fields: { name: "Max Kunde", email: "max@example.com", service: "Dach" }, customerName: "Max Kunde", service: "Dach", source: "email", status: "CONVERTED", assignedTo: null, summary: "" });
    await store.saveAppointment({ caseId: k.id, title: "Termin", startsAt: tomorrow.startsAt, durationMin: 60, notes: "", status: "confirmed" });
    expect(await sendAppointmentReminders(store, now)).toBe(1);
    expect((await store.listMessages(k.id)).at(-1)?.content).toContain("Erinnerung");
    expect(await sendAppointmentReminders(store, now)).toBe(0);
    const company = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...company.businessProfile, automation: { apptReminders: false } } });
    await store.updateCase(k.id, { fields: { apptReminded: "" } });
    expect(await sendAppointmentReminders(store, now)).toBe(0);
  });
});
