import type { InboundAttachment } from "./email";

/** Absenderadresse für Mails, die FallFlow selbst über Resend verschickt (Domain bei Resend bestätigt). */
export const FROM_ADDRESS = process.env.RESEND_FROM || "anfragen@fallflow.eu";

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
