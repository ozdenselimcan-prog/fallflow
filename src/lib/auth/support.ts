import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Support-Zugang: Ein Betrieb erlaubt dem FallFlow-Support für einige Tage, sein Konto einzurichten (Einstellungen →
 * Team). Ein Betreiber (ADMIN_EMAILS) öffnet das Konto dann über /admin – ohne Passwort des Kunden. Gemerkt wird das
 * in einem signierten Cookie; getSession() schaltet damit auf den Betrieb um (Rolle ADMIN, also ohne Abrechnung).
 */
export const SUPPORT_COOKIE = "ff_support";
export const SUPPORT_DAYS = 7;
/** So lange bleibt ein geöffneter Support-Modus bestehen, danach muss er neu geöffnet werden. */
export const SUPPORT_SESSION_HOURS = 8;

export interface SupportAccess {
  grantedAt: string;
  until: string;
  grantedBy: string;
  lastUsedAt?: string;
}

export const supportAccessActive = (access: SupportAccess | undefined | null, now = Date.now()) => Boolean(access?.until && Date.parse(access.until) > now);

const key = () => process.env.CONNECTIONS_SECRET || process.env.CRON_SECRET || "";

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

/** Cookie-Wert: "<companyId>.<ablauf ms>.<signatur>" – nur mit dem Server-Geheimnis zu erzeugen. */
export function supportToken(companyId: string, now = Date.now()): string {
  const payload = `${companyId}.${now + SUPPORT_SESSION_HOURS * 3_600_000}`;
  return `${payload}.${sign(payload)}`;
}

/** Prüft Signatur und Ablauf; gibt die Company-ID zurück oder null. */
export function readSupportToken(value: string | undefined, now = Date.now()): string | null {
  if (!value || !key()) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [companyId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${companyId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(exp) > now)) return null;
  return companyId;
}
