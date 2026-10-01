import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { appointmentConfirmedText, formatSlot } from "@/lib/intake/scheduling";

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

    const appt = (await store.listAppointments()).find((a) => a.id === id);
    if (!appt) return apiError("Termin nicht gefunden", 404);
    if (!appt.caseId) return apiError("Termin ist keinem Fall zugeordnet", 400);
    const c = await store.getCase(appt.caseId);
    if (!c) return apiError("Fall nicht gefunden", 404);

    const saved = await store.saveAppointment({ ...appt, startsAt: newStart.toISOString(), status: "confirmed" });
    await store.updateCase(c.id, { fields: { apptStage: "confirmed" } });
    await store.addEvent(c.id, "appointment", `Vorschlag abgelehnt, Team hat stattdessen bestätigt: ${formatSlot(newStart)}`);

    const text = appointmentConfirmedText(newStart);
    const channel = c.source === "whatsapp" || (!c.fields.email && c.fields.phone) ? "whatsapp" : "email";
    const result = await deliverToCustomer({ companyId: c.companyId, channel, email: c.fields.email, phone: c.fields.phone, text, subject: "Ihr Beratungstermin" });
    await store.addMessage(c.id, "staff", text, { channel, delivery: result.delivered ? "delivered" : "not_sent" });

    return json({ appointment: saved, delivered: result.delivered, reason: result.reason });
  },
  { permission: "appointments:write" },
);
