// Kleiner Mailserver für die Weiterleitungs-Adressen (z. B. huber-k3f9@in.fallflow.eu, siehe src/lib/integrations/forwarding.ts).
// Nimmt nur Mails an Adressen dieser Domain an und reicht jede Mail an die FallFlow-App weiter (/api/inbound/email).
// Läuft als eigener Dienst (deploy/fallflow-mail.service) auf Port 25; TLS-Zertifikat kommt von Caddy (deploy/mail-tls.sh).
import { readFileSync, existsSync } from "node:fs";
import { SMTPServer } from "smtp-server";

const DOMAIN = (process.env.INBOUND_MAIL_DOMAIN || "in.fallflow.eu").toLowerCase();
const APP = process.env.INBOUND_APP_URL || "http://127.0.0.1:3000/api/inbound/email";
const SECRET = process.env.CRON_SECRET;
const TLS_DIR = process.env.MAIL_TLS_DIR || "/opt/fallflow/mail-tls";
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_RECIPIENTS = 20;
const PORT = Number(process.env.MAIL_PORT || 25);

if (!SECRET) {
  console.error("CRON_SECRET fehlt – ohne kann der Mailserver die App nicht aufrufen.");
  process.exit(1);
}

const smtpError = (code, message) => Object.assign(new Error(message), { responseCode: code });

const tls = existsSync(`${TLS_DIR}/cert.pem`) && existsSync(`${TLS_DIR}/key.pem`) ? { cert: readFileSync(`${TLS_DIR}/cert.pem`), key: readFileSync(`${TLS_DIR}/key.pem`) } : null;
if (!tls) console.warn("Kein TLS-Zertifikat gefunden – Mails werden vorerst unverschlüsselt angenommen.");

const server = new SMTPServer({
  name: DOMAIN,
  banner: "FallFlow",
  authOptional: true,
  disabledCommands: ["AUTH"],
  size: MAX_BYTES,
  hideSTARTTLS: !tls,
  ...(tls ?? {}),
  // Zu langsame oder hängende Verbindungen nicht ewig offen halten.
  socketTimeout: 120_000,
  closeTimeout: 30_000,
  onRcptTo(address, session, callback) {
    const to = address.address.toLowerCase();
    if (!to.endsWith(`@${DOMAIN}`)) return callback(smtpError(550, "Diese Adresse wird hier nicht angenommen"));
    if (session.envelope.rcptTo.length >= MAX_RECIPIENTS) return callback(smtpError(452, "Zu viele Empfänger"));
    callback();
  },
  onData(stream, session, callback) {
    const chunks = [];
    let size = 0;
    stream.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_BYTES) chunks.push(chunk);
    });
    stream.on("error", (err) => callback(err));
    stream.on("end", async () => {
      if (stream.sizeExceeded || size > MAX_BYTES) return callback(smtpError(552, "Mail ist zu groß"));
      const recipients = session.envelope.rcptTo.map((r) => r.address);
      try {
        const res = await fetch(APP, {
          method: "POST",
          headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
          body: JSON.stringify({ recipients, raw: Buffer.concat(chunks).toString("base64") }),
          // Die KI prüft und antwortet in dieser Zeit; absendende Server warten bis zu 10 Minuten.
          signal: AbortSignal.timeout(280_000),
        });
        console.log(`${new Date().toISOString()} ${recipients.join(",")} ${size} Bytes → ${res.status}`);
        if (res.ok) return callback(null, "Angenommen");
        if (res.status === 404) return callback(smtpError(550, "Unbekannte Adresse"));
        if (res.status === 400) return callback(smtpError(554, "Mail konnte nicht gelesen werden"));
        return callback(smtpError(451, "Vorübergehender Fehler, bitte später erneut senden"));
      } catch (err) {
        console.error(`${new Date().toISOString()} App nicht erreichbar:`, err instanceof Error ? err.message : err);
        callback(smtpError(451, "Vorübergehender Fehler, bitte später erneut senden"));
      }
    });
  },
});

server.on("error", (err) => console.error("SMTP-Fehler:", err.message));
server.listen(PORT, () => console.log(`FallFlow-Mailserver für @${DOMAIN} läuft auf Port ${PORT}${tls ? " (mit TLS)" : ""}`));
