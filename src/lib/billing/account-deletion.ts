import { siteConfig } from "@/lib/config/site";
import { getPublicStore } from "@/lib/data";
import { BUCKET } from "@/lib/documents/storage";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { createAdminClient } from "@/lib/supabase/clients";

/** Nach Vertragsende werden die Daten eines Büros nach dieser Frist gelöscht (AVV § 9). */
export const DELETION_DAYS = 30;
/** So viele Tage vorher bekommt das Büro einen Hinweis. */
export const WARNING_DAYS = 7;
const DAY = 86_400_000;

export interface CanceledSubscription {
  companyId: string;
  canceledAt: string | null;
  warnedAt: string | null;
}

/** Löschtermin eines beendeten Abos (null = kein beendetes Abo). */
export function deletionDate(canceledAt: string | null): Date | null {
  return canceledAt ? new Date(Date.parse(canceledAt) + DELETION_DAYS * DAY) : null;
}

/** Was heute für ein beendetes Abo zu tun ist: löschen, warnen oder nichts. */
export function retentionAction(sub: CanceledSubscription, now = new Date()): "delete" | "warn" | null {
  const deleteAt = deletionDate(sub.canceledAt);
  if (!deleteAt) return null;
  if (now >= deleteAt) return "delete";
  if (!sub.warnedAt && now.getTime() >= deleteAt.getTime() - WARNING_DAYS * DAY) return "warn";
  return null;
}

const formatDay = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

/** Hinweis an Inhaber/Admins (über das verbundene Postfach des Büros, falls noch vorhanden). */
async function sendWarning(companyId: string, deleteAt: Date): Promise<void> {
  const store = await getPublicStore(companyId);
  if (!store) return;
  const members = await store.listMembers();
  const to = [...new Set(members.filter((m) => m.status === "active" && (m.role === "OWNER" || m.role === "ADMIN") && m.email).map((m) => m.email))];
  const text = [
    "Ihr FallFlow-Abo ist beendet.",
    `Wie im Auftragsverarbeitungsvertrag vereinbart, löschen wir am ${formatDay(deleteAt)} alle Daten Ihres Büros endgültig – Fälle, Dokumente, Nachrichten und die Postfach-Verbindung.`,
    `Wenn Sie Ihre Daten behalten möchten, laden Sie sie vorher herunter (Einstellungen → Abrechnung → „Alle Daten exportieren“) oder schließen Sie wieder ein Abo ab: ${siteConfig.appUrl}/dashboard/settings/billing`,
  ].join("\n\n");
  for (const email of to) await deliverToCustomer({ companyId, channel: "email", email, subject: "FallFlow: Ihre Daten werden in 7 Tagen gelöscht", text });
}

/** Löscht ALLE Daten eines Büros: Dateien im Speicher, Benutzerkonten (sofern nur in diesem Büro) und die Firma samt allen Tabellen. */
async function deleteCompany(companyId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Service-Role-Key fehlt");

  // 1. Dateien: <companyId>/<Ordner>/<Datei> – Ordner für Ordner leeren.
  const { data: folders } = await admin.storage.from(BUCKET).list(companyId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const prefix = `${companyId}/${folder.name}`;
    for (let round = 0; round < 50; round++) {
      const { data: files } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
      const paths = (files ?? []).filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
      if (!paths.length) break;
      const { error } = await admin.storage.from(BUCKET).remove(paths);
      if (error) throw new Error(`Dateien konnten nicht gelöscht werden: ${error.message}`);
    }
    if (folder.id) await admin.storage.from(BUCKET).remove([prefix]);
  }

  // 2. Benutzerkonten, die zu keinem anderen Büro gehören.
  const { data: members } = await admin.from("company_members").select("user_id").eq("company_id", companyId);
  const userIds = (members ?? []).map((m) => m.user_id as string | null).filter((id): id is string => Boolean(id));

  // 3. Firma löschen – alle Fälle, Nachrichten, Dokumente, Einstellungen, Verbindungen usw. hängen per "on delete cascade" daran.
  const { error } = await admin.from("companies").delete().eq("id", companyId);
  if (error) throw new Error(`Firma konnte nicht gelöscht werden: ${error.message}`);

  for (const userId of userIds) {
    const { count } = await admin.from("company_members").select("company_id", { count: "exact", head: true }).eq("user_id", userId);
    if (!count) await admin.auth.admin.deleteUser(userId);
  }
}

/** Täglicher Lauf (Cron): beendete Abos 7 Tage vorher warnen und nach 30 Tagen vollständig löschen. */
export async function processCanceledCompanies(now = new Date()): Promise<{ warned: number; deleted: number; errors: number }> {
  const admin = createAdminClient();
  const totals = { warned: 0, deleted: 0, errors: 0 };
  if (!admin) return totals;
  const { data, error } = await admin.from("subscriptions").select("company_id, canceled_at, deletion_warning_sent_at").eq("status", "canceled").not("canceled_at", "is", null);
  if (error) {
    console.error("[deletion] Abos konnten nicht gelesen werden:", error.message);
    return totals;
  }
  for (const row of data ?? []) {
    const sub: CanceledSubscription = { companyId: row.company_id, canceledAt: row.canceled_at, warnedAt: row.deletion_warning_sent_at };
    const action = retentionAction(sub, now);
    try {
      if (action === "warn") {
        await sendWarning(sub.companyId, deletionDate(sub.canceledAt)!);
        await admin.from("subscriptions").update({ deletion_warning_sent_at: now.toISOString() }).eq("company_id", sub.companyId);
        totals.warned++;
      } else if (action === "delete") {
        await deleteCompany(sub.companyId);
        console.info(`[deletion] Büro ${sub.companyId} 30 Tage nach Vertragsende gelöscht.`);
        totals.deleted++;
      }
    } catch (err) {
      totals.errors++;
      console.error(`[deletion] Büro ${sub.companyId}:`, err instanceof Error ? err.message : "Fehler");
    }
  }
  return totals;
}
