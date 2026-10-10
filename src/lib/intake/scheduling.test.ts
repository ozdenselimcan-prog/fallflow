import { describe, expect, it } from "vitest";
import { appointmentConfirmedText, findNextSlot, findSlotOnDate, looksLikeCancellation, parseAvailability, parseSpecificDate, ymdToDate, type DateSlotReason } from "./scheduling";

/**
 * findNextSlot/findSlotOnDate lehnen Termine ab, die weniger als 2h in der Zukunft liegen (MIN_LEAD_MS),
 * und vergleichen dabei gegen die ECHTE Systemzeit, nicht gegen den Test-Parameter `from`. Alle Testdaten
 * müssen deshalb relativ zu `Date.now()` berechnet werden statt hartkodierte Kalenderdaten zu verwenden,
 * sonst verfällt die Suite irgendwann von selbst.
 */
const berlinYmdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
function berlinYmd(d: Date) {
  const [y, m, day] = berlinYmdFmt.format(d).split("-").map(Number);
  return { y, m, d: day };
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
function nextWeekday(from: Date, targetDow: number, minDaysAhead: number) {
  let d = addDays(from, minDaysAhead);
  while (d.getUTCDay() !== targetDow) d = addDays(d, 1);
  return d;
}

// Donnerstag (4), mindestens 30 Tage voraus – weit genug weg von der 2h-Mindestvorlaufzeit und von DST-Umstellungen.
const REF = nextWeekday(new Date(), 4, 30);
const REF_YMD = berlinYmd(REF);

describe("parseAvailability", () => {
  it("erkennt einzelne Wochentage (voll und abgekürzt)", () => {
    expect(parseAvailability("Dienstag passt mir gut")).toEqual([2]);
    expect(parseAvailability("Di oder Do wäre super")).toEqual(expect.arrayContaining([2, 4]));
  });

  it("erkennt einen Bereich 'X bis Y'", () => {
    expect(parseAvailability("Montag bis Freitag")).toEqual([1, 2, 3, 4, 5]);
  });

  it("'jederzeit' ergibt alle Wochentage", () => {
    expect(parseAvailability("Jederzeit, bin flexibel")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("ohne erkennbaren Wochentag: null", () => {
    expect(parseAvailability("Ich weiß noch nicht")).toBeNull();
  });
});

describe("parseSpecificDate", () => {
  it("erkennt 'morgen' und 'übermorgen', nicht verwechselt", () => {
    expect(parseSpecificDate("morgen", REF)).toEqual(berlinYmd(addDays(REF, 1)));
    expect(parseSpecificDate("übermorgen", REF)).toEqual(berlinYmd(addDays(REF, 2)));
  });

  it("erkennt 'nächsten <Wochentag>'", () => {
    // REF ist ein Donnerstag; "nächsten Montag" ist der folgende Montag (4 Tage später).
    expect(parseSpecificDate("nächsten Montag", REF)).toEqual(berlinYmd(addDays(REF, 4)));
  });

  it("erkennt Datum mit Monatsname, inkl. explizitem Jahr", () => {
    expect(parseSpecificDate(`3. März ${REF_YMD.y + 3}`, REF)).toEqual({ y: REF_YMD.y + 3, m: 3, d: 3 });
  });

  it("erkennt numerisches Datum (TT.MM.JJJJ)", () => {
    expect(parseSpecificDate(`am 20.03.${REF_YMD.y + 3}`, REF)).toEqual({ y: REF_YMD.y + 3, m: 3, d: 20 });
  });

  it("legt ein Datum ohne Jahr, das dieses Jahr schon vorbei ist, auf das nächste Jahr", () => {
    // Ein Tag kurz VOR dem Bezugspunkt, ohne Jahresangabe genannt, muss auf naechstes Jahr fallen.
    const past = addDays(REF, -2);
    const pastYmd = berlinYmd(past);
    const monthNames = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
    expect(parseSpecificDate(`${pastYmd.d}. ${monthNames[pastYmd.m - 1]}`, REF)).toEqual({ ...pastYmd, y: pastYmd.y + 1 });
  });

  it("ohne erkennbares Datum: null", () => {
    expect(parseSpecificDate("irgendwann mal", REF)).toBeNull();
  });
});

describe("findNextSlot – Zeitzone (Regressionstest für den fruehren Timezone-Bug)", () => {
  it("liefert einen Slot um 09:00 Berlin-Zeit als 08:00 oder 07:00 UTC (je nach Sommer-/Winterzeit)", () => {
    const slot = findNextSlot({
      workingDays: [REF.getUTCDay()],
      customerDays: [REF.getUTCDay()],
      slotStart: "09:00",
      slotEnd: "17:00",
      slotMinutes: 60,
      existing: [],
      from: addDays(REF, -7),
    });
    expect(slot).not.toBeNull();
    // 09:00 Berlin ist je nach Jahreszeit 08:00 UTC (Winterzeit) oder 07:00 UTC (Sommerzeit) – nie etwas anderes.
    expect([7, 8]).toContain(slot!.getUTCHours());
  });

  it("ein Slot sechs Monate später (andere Jahreszeit) landet weiterhin exakt auf 09:00 Berlin-Zeit", () => {
    const other = nextWeekday(addDays(REF, 183), REF.getUTCDay(), 0);
    const slot = findNextSlot({
      workingDays: [other.getUTCDay()],
      customerDays: [other.getUTCDay()],
      slotStart: "09:00",
      slotEnd: "17:00",
      slotMinutes: 60,
      existing: [],
      from: addDays(other, -7),
    });
    expect(slot).not.toBeNull();
    const berlinHour = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hourCycle: "h23", hour: "2-digit" }).format(slot!);
    expect(berlinHour).toBe("09");
  });
});

describe("findNextSlot", () => {
  const base = {
    workingDays: [1, 2, 3, 4, 5],
    customerDays: [1, 2, 3, 4, 5],
    slotStart: "09:00",
    slotEnd: "11:00",
    slotMinutes: 60,
    existing: [],
    from: REF,
  };

  it("findet keinen Termin ohne Schnittmenge aus Büro- und Kundentagen", () => {
    expect(findNextSlot({ ...base, workingDays: [1, 2, 3, 4, 5], customerDays: [0, 6] })).toBeNull();
  });

  it("überspringt bereits belegte Slots am selben Tag", () => {
    // Nur ein möglicher Slot pro Tag (09–10 Uhr), damit ihn zu belegen den ganzen Tag ausbucht.
    const oneSlotPerDay = { ...base, slotEnd: "10:00", workingDays: [5], customerDays: [5] };
    const friday = berlinYmd(nextWeekday(REF, 5, 0));
    const freeFirst = findSlotOnDate(friday, oneSlotPerDay);
    expect(freeFirst.slot).not.toBeNull();

    const slot = findNextSlot({ ...oneSlotPerDay, existing: [{ startsAt: freeFirst.slot!.toISOString(), durationMin: 60 }] });
    expect(slot).not.toBeNull();
    expect(berlinYmd(slot!)).not.toEqual(friday);
  });

  it("respektiert die maximale Terminanzahl pro Tag", () => {
    const friday = nextWeekday(REF, 5, 0);
    const nineAm = ymdToDate(berlinYmd(friday));
    const slot = findNextSlot({ ...base, workingDays: [5], customerDays: [5], existing: [{ startsAt: nineAm.toISOString(), durationMin: 30 }], maxAppointmentsPerDay: 1 });
    expect(slot).not.toBeNull();
    expect(berlinYmd(slot!)).not.toEqual(berlinYmd(friday));
  });
});

describe("findSlotOnDate", () => {
  const base = { workingDays: [1, 2, 3, 4, 5], slotStart: "09:00", slotEnd: "17:00", slotMinutes: 60, existing: [] };

  it("meldet 'not_a_working_day' für einen Tag außerhalb der Bürotage", () => {
    const saturday = berlinYmd(nextWeekday(REF, 6, 0));
    const res = findSlotOnDate(saturday, base);
    expect(res).toEqual<{ slot: Date | null; reason: DateSlotReason }>({ slot: null, reason: "not_a_working_day" });
  });

  it("findet einen freien Slot an einem Bürotag", () => {
    const friday = berlinYmd(nextWeekday(REF, 5, 0));
    const res = findSlotOnDate(friday, base);
    expect(res.reason).toBe("ok");
    expect(res.slot).not.toBeNull();
  });

  it("meldet 'fully_booked', wenn die Tagesobergrenze erreicht ist", () => {
    const friday = nextWeekday(REF, 5, 0);
    const fridayYmd = berlinYmd(friday);
    const nineAm = ymdToDate(fridayYmd);
    const res = findSlotOnDate(fridayYmd, { ...base, existing: [{ startsAt: nineAm.toISOString(), durationMin: 30 }], maxAppointmentsPerDay: 1 });
    expect(res).toEqual<{ slot: Date | null; reason: DateSlotReason }>({ slot: null, reason: "fully_booked" });
  });

  it("meldet 'on_vacation' für einen Tag im eingetragenen Urlaubszeitraum, auch wenn es sonst ein Bürotag wäre", () => {
    const friday = nextWeekday(REF, 5, 0);
    const fridayYmd = berlinYmd(friday);
    const ymdStr = (ymd: { y: number; m: number; d: number }) => `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
    const res = findSlotOnDate(fridayYmd, { ...base, vacation: { from: ymdStr(berlinYmd(addDays(friday, -2))), until: ymdStr(berlinYmd(addDays(friday, 2))) } });
    expect(res).toEqual<{ slot: Date | null; reason: DateSlotReason }>({ slot: null, reason: "on_vacation" });
  });
});

describe("findNextSlot – Urlaubszeitraum", () => {
  const ymdStr = (ymd: { y: number; m: number; d: number }) => `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;

  it("überspringt Tage im Urlaubszeitraum und findet den nächsten freien Tag danach", () => {
    const friday = nextWeekday(REF, 5, 0);
    const vacation = { from: ymdStr(berlinYmd(friday)), until: ymdStr(berlinYmd(addDays(friday, 10))) };
    const slot = findNextSlot({
      workingDays: [1, 2, 3, 4, 5],
      customerDays: [1, 2, 3, 4, 5],
      slotStart: "09:00",
      slotEnd: "17:00",
      slotMinutes: 60,
      existing: [],
      from: friday,
      vacation,
    });
    expect(slot).not.toBeNull();
    const slotYmd = ymdStr(berlinYmd(slot!));
    expect(slotYmd > vacation.until).toBe(true);
  });
});

describe("appointmentConfirmedText", () => {
  const slot = new Date();

  it("nutzt den Standardtext mit Datum ohne eigenes Template", () => {
    expect(appointmentConfirmedText(slot)).toBe(`Termin bestätigt: ${new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }).format(slot)} um ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(slot)} Uhr. Wir freuen uns auf das Gespräch!`);
  });

  it("ersetzt {termin} im eigenen Template durch Datum/Uhrzeit", () => {
    expect(appointmentConfirmedText(slot, "Ihr Termin: {termin}.")).toMatch(/^Ihr Termin: .+\.$/);
    expect(appointmentConfirmedText(slot, "Ihr Termin: {termin}.")).not.toContain("{termin}");
  });

  it("nennt kein Datum, wenn das eigene Template keinen {termin}-Platzhalter hat", () => {
    expect(appointmentConfirmedText(slot, "Wir rufen Sie an.")).toBe("Wir rufen Sie an.");
  });

  it("leeres/nur Leerzeichen-Template fällt auf den Standardtext zurück", () => {
    expect(appointmentConfirmedText(slot, "   ")).toContain("Termin bestätigt:");
  });
});

describe("looksLikeCancellation", () => {
  it("erkennt gängige Absageformulierungen", () => {
    expect(looksLikeCancellation("Ich muss den Termin leider absagen")).toBe(true);
    expect(looksLikeCancellation("Der Termin fällt leider aus")).toBe(true);
    expect(looksLikeCancellation("Ich schaffe es leider nicht")).toBe(true);
    expect(looksLikeCancellation("Kann ich den Termin verschieben?")).toBe(true);
  });

  it("reagiert nicht auf unrelatierten Text", () => {
    expect(looksLikeCancellation("Vielen Dank für den Termin, bis dann!")).toBe(false);
    expect(looksLikeCancellation("Wie teuer ist eine Energieberatung?")).toBe(false);
  });
});

describe("ymdToDate", () => {
  it("erzeugt ein stabiles Datum (Mittag UTC, kein Tagesrand-Risiko)", () => {
    const d = ymdToDate({ y: 2026, m: 3, d: 20 });
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(20);
  });
});
