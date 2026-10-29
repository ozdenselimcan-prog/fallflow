import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { appointmentSchema } from "@/lib/validation";
import { siteConfig } from "@/lib/config/site";
import { pushAppointment, removeAppointment } from "@/lib/integrations/outlook-calendar";

export const GET = withSession(async (_req, { store }) => json({ appointments: await store.listAppointments() }));

/** Neuer Termin. Termine zu einem Fall gelten zunächst als „vorgeschlagen“, bis der Kunde bestätigt hat. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, appointmentSchema);
    if (!body.ok) return body.res;
    const { id: _ignored, ...data } = body.data;
    void _ignored;
    if (data.caseId) {
      const c = await store.getCase(data.caseId);
      if (!c) return apiError("Fall nicht gefunden", 404);
      await store.addEvent(c.id, "appointment", "Termin vorgeschlagen");
      return json({ appointment: await store.saveAppointment({ ...data, status: data.status ?? "proposed" }) }, 201);
    }
    return json({ appointment: await store.saveAppointment(data) }, 201);
  },
  { permission: "appointments:write" },
);

/** Termin ändern, verschieben oder bestätigen. */
export const PUT = withSession(
  async (req, { store, session }) => {
    const body = await parseBody(req, appointmentSchema.required({ id: true }));
    if (!body.ok) return body.res;
    const existing = (await store.listAppointments()).find((a) => a.id === body.data.id);
    if (!existing) return apiError("Termin nicht gefunden", 404);
    if (body.data.status === "confirmed" && existing.status !== "confirmed" && existing.caseId) await store.addEvent(existing.caseId, "appointment", "Termin bestätigt");
    const saved = await store.saveAppointment(body.data);
    // Bestätigte Termine (auch verschobene) im verbundenen Outlook-Kalender aktuell halten.
    if (saved.status === "confirmed") {
      const c = saved.caseId ? await store.getCase(saved.caseId) : null;
      await pushAppointment(session.companyId, saved, {
        customer: c?.customerName ?? saved.title,
        phone: c?.fields.phone,
        email: c?.fields.email,
        address: c ? [c.fields.street, c.fields.postalCode].filter(Boolean).join(", ") : "",
        service: c?.fields.service,
        caseUrl: c ? `${siteConfig.appUrl}/dashboard/cases/${c.id}` : `${siteConfig.appUrl}/dashboard/calendar`,
      });
    }
    return json({ appointment: saved });
  },
  { permission: "appointments:write" },
);

export const DELETE = withSession(
  async (req, { store, session }) => {
    const q = parseQuery(req, z.object({ id: z.string().min(1) }));
    if (!q.success) return apiError("id fehlt", 400);
    await store.deleteAppointment(q.data.id);
    await removeAppointment(session.companyId, q.data.id);
    return json({ ok: true });
  },
  { permission: "appointments:write" },
);
