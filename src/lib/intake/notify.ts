import { attentionOf } from "@/lib/cases/attention";
import { siteConfig } from "@/lib/config/site";
import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";
import { deliverToCustomer, isSimulating } from "@/lib/integrations/outbound";
import { sendResendMail } from "@/lib/integrations/resend";

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
    // Notfall: immer Bescheid geben – auch wenn Benachrichtigungen bei Fragen ausgeschaltet sind.
    const emergency = kind === "attention" && /notfall/i.test(attentionOf(c.fields));
    if (emergency) return await notifyEmergency(store, c, settings.notifyEmail);
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

/**
 * Notfall-Mail an das Büro (zusätzlich zur Push-Nachricht aufs Handy): mit Telefon, Adresse und der Nachricht des Kunden,
 * damit man ohne Umweg zurückrufen kann. Geht über das verbundene Postfach; klappt das nicht (kein Postfach verbunden,
 * Verbindung gestört), über FallFlow selbst (Resend) – ein Notfall darf nicht an einer Postfach-Störung hängen.
 */
async function notifyEmergency(store: Store, c: CaseRecord, notifyEmail: string): Promise<void> {
  const messages = await store.listMessages(c.id);
  const lastFromCustomer = [...messages].reverse().find((m) => m.role === "user");
  // Test im Simulator: nichts verschicken.
  if (isSimulating() || lastFromCustomer?.simulated) return;
  const to = await recipients(store, notifyEmail);
  if (!to.length) return;

  const name = displayName(c);
  const reason = attentionOf(c.fields).replace(/^(Frage des Kunden|Anruf): /, "");
  // Die Straße enthält oft schon PLZ und Ort ("Lindenweg 7, 82166 Gräfelfing") – dann nicht doppelt anhängen.
  const street = c.fields.street ?? "";
  const address = /\b\d{5}\b/.test(street) ? street : [street, [c.fields.postalCode, c.fields.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const subject = `NOTFALL: ${name} – bitte sofort melden`;
  const text = [
    `${name} meldet einen Notfall: ${reason}`,
    [c.fields.phone ? `Telefon: ${c.fields.phone}` : "", c.fields.email ? `E-Mail: ${c.fields.email}` : "", address ? `Adresse: ${address}` : ""].filter(Boolean).join("\n"),
    lastFromCustomer ? `Nachricht des Kunden:\n${lastFromCustomer.content.slice(0, 1200)}` : "",
    "Der Kunde hat eine Eingangsbestätigung bekommen – mit dem Hinweis, Sie in dringenden Fällen anzurufen. Bitte melden Sie sich so schnell wie möglich.",
    `Zum Fall: ${siteConfig.appUrl}/dashboard/cases/${c.id}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const sentTo: string[] = [];
  for (const email of to) {
    const viaMailbox = await deliverToCustomer({ companyId: c.companyId, channel: "email", email, subject, text }).catch(() => ({ delivered: false }));
    if (viaMailbox.delivered) {
      sentTo.push(email);
      continue;
    }
    try {
      await sendResendMail({ fromName: "FallFlow Notfall", to: email, subject, text, ...(c.fields.email ? { replyTo: [c.fields.email] } : {}) });
      sentTo.push(email);
    } catch (err) {
      console.error("[notify] Notfall-Mail fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    }
  }
  if (sentTo.length) await store.addEvent(c.id, "note", `Notfall-Mail an das Büro gesendet (${sentTo.join(", ")})`);
}
