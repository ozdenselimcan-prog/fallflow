import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./connections-store", () => ({ getConnection: async () => ({ status: "connected" }) }));
vi.mock("./tokens", () => ({ getValidTokens: async () => ({ tokens: { accessToken: "token", refreshToken: null, expiresAt: null } }) }));

const { outlookBusy, pushAppointment, removeAppointment } = await import("./outlook-calendar");
const { findNextSlot } = await import("@/lib/intake/scheduling");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));

afterEach(() => fetchMock.mockReset());

describe("Outlook-Kalender", () => {
  it("liefert belegte Zeiten, ohne freie und ohne eigene FallFlow-Termine", async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({
        value: [
          { id: "1", start: { dateTime: "2026-11-02T09:00:00.0000000" }, end: { dateTime: "2026-11-02T10:30:00.0000000" }, showAs: "busy" },
          { id: "2", start: { dateTime: "2026-11-02T12:00:00.0000000" }, end: { dateTime: "2026-11-02T13:00:00.0000000" }, showAs: "free" },
          { id: "3", start: { dateTime: "2026-11-03T08:00:00.0000000" }, end: { dateTime: "2026-11-03T09:00:00.0000000" }, showAs: "busy", singleValueExtendedProperties: [{ id: "x", value: "appt-1" }] },
        ],
      }),
    );
    const busy = await outlookBusy("c1");
    expect(busy).toEqual([{ startsAt: "2026-11-02T09:00:00.000Z", durationMin: 90 }]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/calendarView?");
  });

  it("ist bei Fehlern von Microsoft folgenlos", async () => {
    fetchMock.mockImplementationOnce(() => reply({ error: "x" }, 500));
    expect(await outlookBusy("c1")).toEqual([]);
  });

  it("trägt einen bestätigten Termin ein bzw. aktualisiert ihn", async () => {
    fetchMock.mockImplementationOnce(() => reply({ value: [] })).mockImplementationOnce(() => reply({ id: "neu" }, 201));
    await pushAppointment("c1", { id: "appt-1", title: "Termin Erika", startsAt: "2026-11-02T09:00:00.000Z", durationMin: 60 }, { customer: "Erika", phone: "0170", caseUrl: "https://x/cases/1" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toMatch(/\/events$/);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.subject).toBe("Termin Erika");
    expect(body.start).toEqual({ dateTime: "2026-11-02T09:00:00", timeZone: "UTC" });
    expect(body.end.dateTime).toBe("2026-11-02T10:00:00");
    expect(body.singleValueExtendedProperties[0].value).toBe("appt-1");

    fetchMock.mockImplementationOnce(() => reply({ value: [{ id: "ev1" }] })).mockImplementationOnce(() => reply({}, 200));
    await pushAppointment("c1", { id: "appt-1", title: "Termin Erika", startsAt: "2026-11-02T10:00:00.000Z", durationMin: 60 }, { customer: "Erika", caseUrl: "https://x" });
    expect(fetchMock.mock.calls[3][1].method).toBe("PATCH");
  });

  it("entfernt abgesagte Termine", async () => {
    fetchMock.mockImplementationOnce(() => reply({ value: [{ id: "ev1" }] })).mockImplementationOnce(() => reply(null, 204));
    await removeAppointment("c1", "appt-1");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });
});

describe("Terminsuche mit belegten Kalenderzeiten", () => {
  const base = { workingDays: [1, 2, 3, 4, 5], customerDays: [1, 2, 3, 4, 5], slotStart: "09:00", slotEnd: "12:00", slotMinutes: 60, existing: [], from: new Date("2026-11-02T06:00:00Z") };
  it("überspringt belegte Zeiten", () => {
    const free = findNextSlot(base)!;
    const blocked = findNextSlot({ ...base, blocked: [{ startsAt: free.toISOString(), durationMin: 60 }] })!;
    expect(blocked.getTime()).toBe(free.getTime() + 60 * 60_000);
  });
  it("Kalender-Termine zählen nicht zur Tagesobergrenze", () => {
    const free = findNextSlot({ ...base, maxAppointmentsPerDay: 1 })!;
    const withBlock = findNextSlot({ ...base, maxAppointmentsPerDay: 1, blocked: [{ startsAt: free.toISOString(), durationMin: 60 }] })!;
    expect(withBlock.getTime()).toBe(free.getTime() + 60 * 60_000);
  });
});
