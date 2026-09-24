import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { inviteSchema, roleSchema } from "@/lib/validation";

export const GET = withSession(async (_req, { store }) => json({ members: await store.listMembers() }));

/**
 * Lädt ein Teammitglied ein. Die Einladung wird als "invited" gespeichert und beim Signup mit derselben
 * E-Mail automatisch angenommen (siehe Trigger handle_new_user). Ein Einladungs-Mailversand ist nicht enthalten.
 */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, inviteSchema);
    if (!body.ok) return body.res;
    const members = await store.listMembers();
    if (members.some((m) => m.email.toLowerCase() === body.data.email.toLowerCase())) return apiError("Diese E-Mail ist bereits im Team", 409);
    return json({ member: await store.inviteMember(body.data.email, body.data.role) }, 201);
  },
  { permission: "team:manage" },
);

export const PATCH = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, roleSchema);
    if (!body.ok) return body.res;
    const target = (await store.listMembers()).find((m) => m.id === body.data.id);
    if (!target) return apiError("Mitglied nicht gefunden", 404);
    if (target.role === "OWNER") return apiError("Die Inhaber-Rolle kann nicht geändert werden", 403);
    await store.updateMemberRole(body.data.id, body.data.role);
    return json({ ok: true });
  },
  { permission: "team:manage" },
);

export const DELETE = withSession(
  async (req, { store }) => {
    const q = parseQuery(req, z.object({ id: z.string().min(1) }));
    if (!q.success) return apiError("id fehlt", 400);
    const target = (await store.listMembers()).find((m) => m.id === q.data.id);
    if (!target) return apiError("Mitglied nicht gefunden", 404);
    if (target.role === "OWNER") return apiError("Der Inhaber kann nicht entfernt werden", 403);
    await store.removeMember(q.data.id);
    return json({ ok: true });
  },
  { permission: "team:manage" },
);
