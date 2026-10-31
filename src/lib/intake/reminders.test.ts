import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import type { CaseRecord } from "@/lib/data/types";
import { dueReminder, isDaytimeInGermany, sendReminders } from "./reminders";

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
