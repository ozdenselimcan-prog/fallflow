import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { stripHtml, type InboundEmail, type MailSyncProvider, type ProviderTokens } from "./email";

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
          out.push({
            externalId: String(msg.uid),
            from: parsed.from?.text ?? "",
            subject: parsed.subject ?? "",
            body: (parsed.text ?? stripHtml(typeof parsed.html === "string" ? parsed.html : "")).slice(0, 4000),
            receivedAt: (parsed.date ?? new Date()).toISOString(),
          });
        }
      } finally {
        lock.release();
      }
      return out;
    });
  },

  async sendReply(tokens, to, subject, body) {
    const creds = parseCreds(tokens);
    await smtpTransport(creds).sendMail({ from: creds.email, to, subject, text: body });
  },
};
