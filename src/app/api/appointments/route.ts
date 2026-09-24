import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { appointmentSchema } from "@/lib/validation";

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
  async (req, { store }) => {
    const body = await parseBody(req, appointmentSchema.required({ id: true }));
    if (!body.ok) return body.res;
    const existing = (await store.listAppointments()).find((a) => a.id === body.data.id);
    if (!existing) return apiError("Termin nicht gefunden", 404);
    if (body.data.status === "confirmed" && existing.status !== "confirmed" && existing.caseId) await store.addEvent(existing.caseId, "appointment", "Termin bestätigt");
    return json({ appointment: await store.saveAppointment(body.data) });
  },
  { permission: "appointments:write" },
);

export const DELETE = withSession(
  async (req, { store }) => {
    const q = parseQuery(req, z.object({ id: z.string().min(1) }));
    if (!q.success) return apiError("id fehlt", 400);
    await store.deleteAppointment(q.data.id);
    return json({ ok: true });
  },
  { permission: "appointments:write" },
);
