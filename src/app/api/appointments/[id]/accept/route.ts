import { apiError, json, withSession } from "@/lib/api";
import { confirmAppointment } from "@/lib/intake/case-ops";

/**
 * Mitarbeiter übernimmt den von der KI vorgeschlagenen Termin unverändert: Termin gilt als bestätigt,
 * der Kunde erfährt den genauen Zeitpunkt erst jetzt per Nachricht (nicht schon vorher von der KI).
 */
export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/appointments/[id]/accept">) => {
    const { id } = await ctx.params;
    const result = await confirmAppointment(store, id);
    if (!result.ok) return apiError(result.message, result.status);
    return json({ appointment: result.appointment, delivered: result.delivered, reason: result.reason });
  },
  { permission: "appointments:write" },
);
