import type { Appointment } from "@/lib/data/types";
import { getConnection } from "./connections-store";
import type { MailSyncProvider, ProviderTokens } from "./email";
import { calendarRefresh } from "./microsoft";
import { getValidTokens } from "./tokens";

/**
 * Abgleich mit dem Outlook-/Microsoft-365-Kalender des Betriebs (eigene Verbindung "outlook_calendar", getrennt vom
 * E-Mail-Postfach – so bleibt die Mail-Anbindung unberührt):
 *  - Belegte Zeiten im Outlook-Kalender werden bei Terminvorschlägen ausgelassen.
 *  - Bestätigte Termine werden als Termin in Outlook eingetragen, abgesagte wieder entfernt.
 * Jeder Fehler (keine Verbindung, Microsoft nicht erreichbar) ist folgenlos: Die Terminvergabe läuft dann wie bisher.
 */

const GRAPH = "https://graph.microsoft.com/v1.0/me";
/** Eigene Kennung am Outlook-Termin, damit wir ihn später wiederfinden (ohne zusätzliche Datenbankspalte). */
const PROP_ID = "String {6c1f4d2a-8f3b-4f0e-9b7d-2a6f5c3e1d90} Name FallFlowAppointmentId";
const HORIZON_DAYS = 30;

const calendarProvider = { id: "outlook_calendar", refreshTokens: calendarRefresh } as unknown as MailSyncProvider;

async function tokensFor(companyId: string): Promise<ProviderTokens | null> {
  try {
    if (!(await getConnection(companyId, "outlook_calendar"))) return null;
    return (await getValidTokens(calendarProvider, companyId))?.tokens ?? null;
  } catch {
    return null;
  }
}

async function graph<T>(tokens: ProviderTokens, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Prefer: 'outlook.timezone="UTC"', ...init.headers, Authorization: `Bearer ${tokens.accessToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Outlook-Kalender: HTTP ${res.status}`);
  return res.status === 204 || res.status === 202 ? null : ((await res.json()) as T);
}

interface GraphEvent {
  id: string;
  start: { dateTime: string };
  end: { dateTime: string };
  showAs?: string;
  isCancelled?: boolean;
  singleValueExtendedProperties?: { id: string; value: string }[];
}

/** Graph liefert UTC-Zeiten ohne "Z" (wegen Prefer: outlook.timezone="UTC"). */
const utc = (s: string) => Date.parse(/Z|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);

/**
 * Belegte Zeiten aus Outlook in den nächsten Wochen (als Blocker für die Terminsuche). Eigene, von FallFlow
 * eingetragene Termine werden übersprungen – die kennt die Terminsuche schon aus FallFlow selbst.
 */
export async function outlookBusy(companyId: string): Promise<Pick<Appointment, "startsAt" | "durationMin">[]> {
  const tokens = await tokensFor(companyId);
  if (!tokens) return [];
  try {
    const from = new Date();
    const to = new Date(Date.now() + HORIZON_DAYS * 86_400_000);
    const q = new URLSearchParams({
      startDateTime: from.toISOString(),
      endDateTime: to.toISOString(),
      $select: "start,end,showAs,isCancelled",
      $top: "250",
      $expand: `singleValueExtendedProperties($filter=id eq '${PROP_ID}')`,
    });
    const data = await graph<{ value?: GraphEvent[] }>(tokens, `/calendarView?${q}`);
    return (data?.value ?? [])
      .filter((e) => !e.isCancelled && e.showAs !== "free" && !e.singleValueExtendedProperties?.length)
      .map((e) => {
        const start = utc(e.start.dateTime);
        return { startsAt: new Date(start).toISOString(), durationMin: Math.max(1, Math.round((utc(e.end.dateTime) - start) / 60_000)) };
      });
  } catch (err) {
    console.error("[outlook-calendar] Belegte Zeiten nicht abrufbar:", err instanceof Error ? err.message : "unbekannt");
    return [];
  }
}

async function findEventId(tokens: ProviderTokens, appointmentId: string): Promise<string | null> {
  const q = new URLSearchParams({ $filter: `singleValueExtendedProperties/Any(ep: ep/id eq '${PROP_ID}' and ep/value eq '${appointmentId}')`, $select: "id" });
  const data = await graph<{ value?: { id: string }[] }>(tokens, `/events?${q}`);
  return data?.value?.[0]?.id ?? null;
}

/** Bestätigten Termin in Outlook eintragen bzw. aktualisieren (bei geänderter Uhrzeit). */
export async function pushAppointment(companyId: string, a: Pick<Appointment, "id" | "title" | "startsAt" | "durationMin">, details: { customer: string; phone?: string; email?: string; address?: string; service?: string; caseUrl: string }): Promise<void> {
  const tokens = await tokensFor(companyId);
  if (!tokens) return;
  try {
    const start = new Date(a.startsAt);
    const end = new Date(start.getTime() + a.durationMin * 60_000);
    const lines = [
      details.service && `Anliegen: ${details.service}`,
      `Kunde: ${details.customer}`,
      details.phone && `Telefon: ${details.phone}`,
      details.email && `E-Mail: ${details.email}`,
      details.address && `Adresse: ${details.address}`,
      `Fallakte: ${details.caseUrl}`,
    ].filter(Boolean);
    const event = {
      subject: a.title,
      body: { contentType: "text", content: lines.join("\n") },
      start: { dateTime: start.toISOString().slice(0, 19), timeZone: "UTC" },
      end: { dateTime: end.toISOString().slice(0, 19), timeZone: "UTC" },
      ...(details.address ? { location: { displayName: details.address } } : {}),
      singleValueExtendedProperties: [{ id: PROP_ID, value: a.id }],
    };
    const existing = await findEventId(tokens, a.id);
    if (existing) await graph(tokens, `/events/${encodeURIComponent(existing)}`, { method: "PATCH", body: JSON.stringify(event) });
    else await graph(tokens, "/events", { method: "POST", body: JSON.stringify(event) });
  } catch (err) {
    console.error("[outlook-calendar] Termin nicht eingetragen:", err instanceof Error ? err.message : "unbekannt");
  }
}

/** Abgesagten bzw. gelöschten Termin aus Outlook entfernen. */
export async function removeAppointment(companyId: string, appointmentId: string): Promise<void> {
  const tokens = await tokensFor(companyId);
  if (!tokens) return;
  try {
    const id = await findEventId(tokens, appointmentId);
    if (id) await graph(tokens, `/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    console.error("[outlook-calendar] Termin nicht entfernt:", err instanceof Error ? err.message : "unbekannt");
  }
}
