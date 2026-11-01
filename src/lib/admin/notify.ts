import { getPublicStore } from "@/lib/data";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/clients";

/**
 * Hinweis an die Betreiber (ADMIN_EMAILS): per E-Mail über das verbundene Postfach ihres eigenen Büros und per Push auf ihre
 * Geräte. Fehlt beides, bleibt der Eintrag trotzdem in der Betreiber-Übersicht (/admin) sichtbar.
 */
export async function notifyPlatformAdmins(message: { subject: string; text: string; url: string }): Promise<void> {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const admin = createAdminClient();
  if (!emails.length || !admin) return;
  const { data } = await admin.from("company_members").select("company_id, email").in("email", emails);
  const seen = new Set<string>();
  for (const m of data ?? []) {
    try {
      await deliverToCustomer({ companyId: m.company_id, channel: "email", email: m.email, subject: message.subject, text: message.text });
      if (seen.has(m.company_id)) continue;
      seen.add(m.company_id);
      const store = await getPublicStore(m.company_id);
      if (store) await sendPush(store, { title: message.subject, body: message.text.split("\n")[0].slice(0, 120), url: message.url });
    } catch (err) {
      console.error("[admin/notify]", err instanceof Error ? err.message : "Fehler");
    }
  }
}
