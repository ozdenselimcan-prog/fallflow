import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { stripHtml, type InboundAttachment, type InboundEmail, type MailSyncProvider, type ProviderTokens } from "./email";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Generische E-Mail-Verbindung per IMAP (Abruf) und SMTP (Versand) mit den eigenen Zugangsdaten des
 * Büros – kein OAuth, keine Google-/Microsoft-App-Überprüfung nötig. Funktioniert mit jedem Anbieter,
 * der IMAP/SMTP anbietet (Gmail per App-Passwort, Outlook, GMX, Web.de, IONOS, Strato, eigene Domain …).
 * Der Provider-Name "gmail" ist nur noch der interne Bezeichner (DB-Spalte, Route) aus der Zeit, als es
 * ausschließlich Gmail-OAuth war – nach außen heißt das Label jetzt einfach "E-Mail".
 */

export interface ImapSmtpCredentials {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

function parseCreds(tokens: ProviderTokens): ImapSmtpCredentials {
  return JSON.parse(tokens.accessToken) as ImapSmtpCredentials;
}

export function encodeCredentials(creds: ImapSmtpCredentials): string {
  return JSON.stringify(creds);
}

async function withImapClient<T>(creds: ImapSmtpCredentials, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapPort !== 143,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

function smtpTransport(creds: ImapSmtpCredentials) {
  return nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpPort === 465,
    auth: { user: creds.email, pass: creds.password },
  });
}

export const gmailProvider: MailSyncProvider = {
  id: "gmail",
  label: "E-Mail",
  // Kein globales App-Secret nötig (jedes Büro bringt seine eigenen Zugangsdaten mit), daher immer "konfiguriert".
  missingConfig: () => [],

  async testConnection(tokens) {
    const creds = parseCreds(tokens);
    await withImapClient(creds, async (client) => {
      await client.mailboxOpen("INBOX");
    });
    await smtpTransport(creds).verify();
  },

  async fetchNewMessages(tokens, sinceIso) {
    const creds = parseCreds(tokens);
    const since = new Date(sinceIso ?? Date.now() - 86_400_000);
    return withImapClient(creds, async (client) => {
      const lock = await client.getMailboxLock("INBOX");
      const out: InboundEmail[] = [];
      try {
        const uids = await client.search({ since }, { uid: true });
        const recent = (uids || []).slice(-20);
        if (!recent.length) return out;
        for await (const msg of client.fetch(recent, { source: true, uid: true }, { uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          // Übernommen werden PDFs sowie echte Foto-Anhänge (z. B. Grundriss/Energieausweis als Foto) in
          // vernünftiger Größe – Bilder in Signaturen (inline, klein) und große Dateien werden ignoriert.
          const isImage = (a: { contentType: string; contentDisposition?: string; content?: Buffer }) =>
            ["image/jpeg", "image/png", "image/webp"].includes(a.contentType) && a.contentDisposition === "attachment" && (a.content?.length ?? 0) >= 20_000;
          const attachments: InboundAttachment[] = (parsed.attachments ?? [])
            .filter((a) => (a.contentType === "application/pdf" || isImage(a)) && a.content && a.content.length > 0 && a.content.length <= MAX_ATTACHMENT_BYTES)
            .map((a) => ({ filename: a.filename || (a.contentType === "application/pdf" ? "dokument.pdf" : "foto"), mime: a.contentType, bytes: new Uint8Array(a.content) }));
          // RFC 3834: "Auto-Submitted: no" (oder fehlend) = normale Mail eines Menschen; jeder andere Wert
          // (z. B. "auto-replied", "auto-generated") kommt von einem automatisch antwortenden System – das darf
          // niemals wieder automatisch beantwortet werden, sonst entsteht eine Endlosschleife (z. B. mit einer
          // Abwesenheitsnotiz oder einem anderen Büro, das ebenfalls FallFlow nutzt).
          const autoSubmittedHeader = parsed.headers.get("auto-submitted");
          const autoSubmitted = typeof autoSubmittedHeader === "string" && autoSubmittedHeader.toLowerCase() !== "no";
          out.push({
            externalId: String(msg.uid),
            from: parsed.from?.text ?? "",
            subject: parsed.subject ?? "",
            body: (parsed.text ?? stripHtml(typeof parsed.html === "string" ? parsed.html : "")).slice(0, 4000),
            receivedAt: (parsed.date ?? new Date()).toISOString(),
            attachments,
            autoSubmitted,
          });
        }
      } finally {
        lock.release();
      }
      return out;
    });
  },

  async sendReply(tokens, to, subject, body, attachments) {
    const creds = parseCreds(tokens);
    await smtpTransport(creds).sendMail({
      from: creds.email,
      to,
      subject,
      text: body,
      attachments: attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.bytes), contentType: a.mime })),
      // RFC 3834: markiert die Mail als automatisch versendet, damit andere automatische Systeme (z. B. ein
      // Abwesenheitsassistent oder ein anderes Büro, das ebenfalls FallFlow nutzt) sie nicht wiederum
      // automatisch beantworten – verhindert Endlosschleifen zwischen zwei auto-antwortenden Postfächern.
      headers: { "Auto-Submitted": "auto-replied" },
    });
  },
};
