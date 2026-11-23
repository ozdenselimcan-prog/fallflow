import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import type { Session } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { sendResendMail } from "@/lib/integrations/resend";
import { inviteSchema, roleSchema } from "@/lib/validation";

function sendInviteMail(email: string, companyName: string, inviter: Session) {
  const who = [inviter.firstName, inviter.lastName].filter(Boolean).join(" ") || inviter.email;
  const link = `${siteConfig.appUrl}/signup`;
  const text = [
    "Guten Tag,",
    "",
    `${who} hat Sie eingeladen, bei „${companyName}“ in FallFlow mitzuarbeiten – dort laufen die Kundenanfragen des Betriebs zusammen.`,
    "",
    `So geht's: Registrieren Sie sich mit genau dieser E-Mail-Adresse (${email}) unter ${link}`,
    `Bei „Unternehmen“ tragen Sie einfach „${companyName}“ ein. Nach der Bestätigung Ihrer E-Mail-Adresse sind Sie automatisch im Team.`,
    "",
    "Viele Grüße",
    "FallFlow",
  ].join("\n");
  return sendResendMail({ fromName: "FallFlow", to: email, replyTo: [inviter.email], subject: `Einladung ins Team von ${companyName}`, text });
}

export const GET = withSession(async (_req, { store }) => json({ members: await store.listMembers() }));

/**
 * Lädt ein Teammitglied ein. Die Einladung wird als "invited" gespeichert und beim Signup mit derselben
 * E-Mail automatisch angenommen (siehe Trigger handle_new_user). Die eingeladene Person bekommt dazu eine E-Mail.
 */
export const POST = withSession(
  async (req, { store, session }) => {
    const body = await parseBody(req, inviteSchema);
    if (!body.ok) return body.res;
    const members = await store.listMembers();
    if (members.some((m) => m.email.toLowerCase() === body.data.email.toLowerCase())) return apiError("Diese E-Mail ist bereits im Team", 409);
    const member = await store.inviteMember(body.data.email, body.data.role);
    // Die Einladung gilt auch ohne Mail – ein Versandfehler soll sie nicht scheitern lassen, nur gemeldet werden.
    const mailSent = await sendInviteMail(body.data.email, (await store.getCompany()).name, session).then(
      () => true,
      (err: unknown) => {
        console.error("[team] Einladungs-Mail fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
        return false;
      },
    );
    return json({ member, mailSent }, 201);
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
