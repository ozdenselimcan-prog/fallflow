export class IntegrationNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationNotReadyError";
  }
}

export interface InboundEmail {
  externalId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

/** Für den Abruf/Versand nötige, bereits entschlüsselte Zugangsdaten dieses Büros. Bei der aktuellen
 * IMAP/SMTP-Verbindung (siehe gmail.ts) ist `accessToken` ein JSON-String mit Passwort/Host/Port. */
export interface ProviderTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

/** Grobe Text-Extraktion aus HTML-Mail-Inhalt (Tags entfernen, Whitespace normalisieren) – kein echter HTML-Parser. */
export const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Schnittstelle, die der Mail-Abruf (mail-sync.ts) und der Versand (outbound.ts) brauchen. */
export interface MailSyncProvider {
  readonly id: "gmail";
  readonly label: string;
  /** Environment Variables der FallFlow-App-Identität, die fehlen (leer = konfiguriert). Bei IMAP/SMTP immer leer. */
  missingConfig(): string[];
  /** Nur bei OAuth-Anbietern vorhanden (aktuell keiner mehr). */
  refreshTokens?(refreshToken: string): Promise<RefreshedTokens>;
  /** Leichter Aufruf, um zu prüfen, ob die gespeicherten Zugangsdaten noch funktionieren. Wirft bei Fehler. */
  testConnection(tokens: ProviderTokens): Promise<void>;
  fetchNewMessages(tokens: ProviderTokens, sinceIso: string | null): Promise<InboundEmail[]>;
  sendReply(tokens: ProviderTokens, to: string, subject: string, body: string): Promise<void>;
}
