import { apiError, json, withSession } from "@/lib/api";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { appointmentConfirmedText, formatSlot } from "@/lib/intake/scheduling";

/**
 * Mitarbeiter übernimmt den von der KI vorgeschlagenen Termin unverändert: Termin gilt als bestätigt,
 * der Kunde erfährt den genauen Zeitpunkt erst jetzt per Nachricht (nicht schon vorher von der KI).
 */
export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/appointments/[id]/accept">) => {
    const { id } = await ctx.params;
    const appt = (await store.listAppointments()).find((a) => a.id === id);
    if (!appt) return apiError("Termin nicht gefunden", 404);
    if (!appt.caseId) return apiError("Termin ist keinem Fall zugeordnet", 400);
    const c = await store.getCase(appt.caseId);
    if (!c) return apiError("Fall nicht gefunden", 404);

    const saved = await store.saveAppointment({ ...appt, status: "confirmed" });
    await store.updateCase(c.id, { fields: { apptStage: "confirmed" } });
    await store.addEvent(c.id, "appointment", `Termin vom Team bestätigt: ${formatSlot(new Date(saved.startsAt))}`);

    const text = appointmentConfirmedText(new Date(saved.startsAt));
    const channel = c.source === "whatsapp" || (!c.fields.email && c.fields.phone) ? "whatsapp" : "email";
    const result = await deliverToCustomer({ companyId: c.companyId, channel, email: c.fields.email, phone: c.fields.phone, text, subject: "Ihr Beratungstermin" });
    await store.addMessage(c.id, "staff", text, { channel, delivery: result.delivered ? "delivered" : "not_sent" });

    return json({ appointment: saved, delivered: result.delivered, reason: result.reason });
  },
  { permission: "appointments:write" },
);
