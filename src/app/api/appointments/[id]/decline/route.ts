import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { confirmAppointment } from "@/lib/intake/case-ops";

const declineSchema = z.object({ startsAt: z.string().min(1) });

/**
 * Mitarbeiter lehnt den von der KI vorgeschlagenen Termin ab und legt selbst einen anderen Zeitpunkt fest.
 * Dieser neue Termin gilt sofort als bestätigt und wird dem Kunden mitgeteilt – die KI hatte ihm vorher
 * noch keinen Termin genannt.
 */
export const POST = withSession(
  async (req, { store }, ctx: RouteContext<"/api/appointments/[id]/decline">) => {
    const { id } = await ctx.params;
    const body = await parseBody(req, declineSchema);
    if (!body.ok) return body.res;
    const newStart = new Date(body.data.startsAt);
    if (Number.isNaN(newStart.getTime())) return apiError("Ungültiges Datum", 400);

    const result = await confirmAppointment(store, id, newStart.toISOString());
    if (!result.ok) return apiError(result.message, result.status);
    return json({ appointment: result.appointment, delivered: result.delivered, reason: result.reason });
  },
  { permission: "appointments:write" },
);
