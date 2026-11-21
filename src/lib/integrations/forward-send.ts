import type { Connection } from "./connections-store";
import { replySubject, type InboundAttachment, type ReplyTarget } from "./email";

/** Domain der Weiterleitungs-Adressen (MX zeigt auf den FallFlow-Server, siehe deploy/mail-inbound.mjs). */
export const INBOUND_DOMAIN = (process.env.INBOUND_MAIL_DOMAIN || "in.fallflow.eu").toLowerCase();
/** Absenderadresse für Antworten bei Weiterleitung (Domain muss bei Resend bestätigt sein). */
export const FROM_ADDRESS = process.env.FORWARD_MAIL_FROM || "anfragen@fallflow.eu";

/** Die FallFlow-Adresse eines Betriebs, z. B. huber-k3f9@in.fallflow.eu (siehe forwarding.ts). */
export const forwardingAddress = (c: Connection) => `${String(c.metadata.address ?? "")}@${INBOUND_DOMAIN}`;

/**
 * Antwort an einen Kunden über Resend: Absender "Name des Betriebs <anfragen@fallflow.eu>", Antwortadresse = die eigene
 * Adresse des Betriebs plus die FallFlow-Adresse – so landet die Antwort des Kunden beim Betrieb und sicher auch bei
 * FallFlow, selbst wenn der Betrieb nur einen Teil seiner Mails weiterleitet (doppelte Zustellung siehe `seen`).
 */
export async function sendAsCompany(
  conn: Connection,
  companyName: string,
  mail: { to: string; subject: string; body: string; attachments?: InboundAttachment[]; reply?: ReplyTarget },
): Promise<void> {
  const name = (companyName || conn.accountName || "FallFlow").replace(/["<>]/g, "");
  const headers: Record<string, string> = { "Auto-Submitted": "auto-replied" };
  if (mail.reply?.messageId) {
    headers["In-Reply-To"] = mail.reply.messageId;
    headers.References = mail.reply.messageId;
  }
  await sendResendMail({
    fromName: name,
    to: mail.to,
    replyTo: [conn.accountEmail, forwardingAddress(conn)].filter(Boolean),
    subject: mail.reply ? replySubject(mail.reply.subject, mail.subject) : mail.subject,
    text: mail.body,
    headers,
    attachments: mail.attachments,
  });
}

/** Eine Mail über Resend verschicken (Absenderadresse FROM_ADDRESS, Domain bei Resend bestätigt). */
export async function sendResendMail(mail: {
  fromName: string;
  to: string;
  replyTo?: string[];
  subject: string;
  text: string;
  headers?: Record<string, string>;
  attachments?: InboundAttachment[];
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Versand über FallFlow ist noch nicht eingerichtet (RESEND_API_KEY fehlt).");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${mail.fromName.replace(/["<>]/g, "")} <${FROM_ADDRESS}>`,
      to: [mail.to],
      ...(mail.replyTo?.length ? { reply_to: mail.replyTo } : {}),
      subject: mail.subject,
      text: mail.text,
      ...(mail.headers ? { headers: mail.headers } : {}),
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.bytes).toString("base64"), content_type: a.mime })),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
