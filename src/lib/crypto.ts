import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Verschlüsselung für Zugangsdaten, die FallFlow im Auftrag eines Kunden speichert (OAuth-Tokens,
 * Zugriffstoken). AES-256-GCM mit einem Schlüssel, der ausschließlich als Environment Variable
 * existiert (CONNECTIONS_SECRET) – nie in der Datenbank. Ohne diesen Schlüssel bleiben Kanal-Verbindungen
 * bewusst deaktiviert (fail closed), statt Tokens unverschlüsselt abzulegen.
 */

function key(): Buffer | null {
  const raw = process.env.CONNECTIONS_SECRET;
  if (!raw || raw.length < 32) return null;
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
}

export const encryptionAvailable = () => key() !== null;

/** Verschlüsselt einen Wert. Format: base64(iv).base64(authTag).base64(ciphertext) */
export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) throw new Error("CONNECTIONS_SECRET ist nicht gesetzt");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(value: string): string | null {
  const k = key();
  if (!k) return null;
  const [ivB64, tagB64, dataB64] = value.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
