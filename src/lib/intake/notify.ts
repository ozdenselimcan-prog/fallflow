import { attentionOf } from "@/lib/cases/attention";
import { siteConfig } from "@/lib/config/site";
import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";

export type OfficeNotice = "attention" | "ready";

/** An wen die Benachrichtigungen gehen: eigene Adresse aus den Einstellungen, sonst alle Inhaber und Admins. */
async function recipients(store: Store, notifyEmail: string): Promise<string[]> {
  if (notifyEmail.trim()) return [notifyEmail.trim()];
  const members = await store.listMembers();
  return [...new Set(members.filter((m) => m.status === "active" && (m.role === "OWNER" || m.role === "ADMIN") && m.email).map((m) => m.email.toLowerCase()))];
}

const displayName = (c: CaseRecord) => (c.customerName && c.customerName !== "Unbekannt" ? c.customerName : (c.fields.email ?? "Unbekannter Absender"));

/**
 * Kurze E-Mail an das Büro, damit nichts im Dashboard liegen bleibt: wenn ein Kunde eine Frage stellt bzw. die Leistung
 * unklar ist ("Aufmerksamkeit benötigt") oder wenn ein Fall fertig vorbereitet ist. Versand über das verbundene
 * Postfach des Büros an sich selbst – es wird kein zusätzlicher Dienst gebraucht. Fehler werden nur protokolliert.
 */
export async function notifyOffice(store: Store, c: CaseRecord, kind: OfficeNotice): Promise<void> {
  try {
    const settings = await store.getAssistant();
    if (kind === "attention" ? !settings.notifyAttention : !settings.notifyReady) return;
    const to = await recipients(store, settings.notifyEmail);
    if (!to.length) return;

    const name = displayName(c);
    const link = `${siteConfig.appUrl}/dashboard/cases/${c.id}`;
    const service = c.fields.service && c.fields.service !== "Sonstiges" ? c.fields.service : "";
    const subject =
      kind === "attention" ? `FallFlow: ${name} wartet auf Ihre Antwort` : `FallFlow: Fall bereit zur Prüfung – ${name}${service ? ` (${service})` : ""}`;
    const text =
      kind === "attention"
        ? [
            `${name}${c.fields.email && name !== c.fields.email ? ` (${c.fields.email})` : ""} hat Ihnen geschrieben.`,
            `Grund: ${attentionOf(c.fields) || "Aufmerksamkeit benötigt"}.`,
            "Die KI hat bewusst nicht automatisch geantwortet – bitte antworten Sie dem Kunden selbst (direkt in FallFlow oder in Ihrem E-Mail-Programm).",
            `Zum Fall: ${link}`,
          ].join("\n\n")
        : [
            `Der Fall von ${name}${service ? ` (${service})` : ""} ist vollständig vorbereitet: Alle Angaben und Unterlagen liegen vor.`,
            "Falls ein Termin vorgeschlagen wurde, bestätigen Sie ihn bitte im Kalender – erst dann erhält der Kunde die Terminbestätigung.",
            `Zum Fall: ${link}`,
          ].join("\n\n");

    let sent = 0;
    for (const email of to) {
      const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email, subject, text });
      if (result.delivered) sent++;
    }
    if (sent) await store.addEvent(c.id, "note", `Benachrichtigung an das Büro gesendet (${to.join(", ")})`);
  } catch (err) {
    console.error("[notify] Benachrichtigung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
  }
}
