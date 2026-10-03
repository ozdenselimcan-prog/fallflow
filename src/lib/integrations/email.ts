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

export interface ExchangeResult {
  account: string;
  accessToken: string;
  refreshToken: string | null;
  /** Sekunden bis zum Ablauf des Access Tokens */
  expiresIn: number;
}

/** Für den Abruf/Versand nötige, bereits entschlüsselte Zugangsdaten dieses Büros. */
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

/**
 * Minimale Schnittstelle, die der Mail-Abruf (mail-sync.ts) für JEDEN Anbieter braucht, egal ob er per
 * OAuth (Microsoft) oder per IMAP/SMTP-Zugangsdaten (generisches "E-Mail", siehe gmail.ts) verbindet.
 * `ProviderTokens.accessToken` ist bei OAuth ein Bearer-Token, bei IMAP/SMTP ein JSON-String mit den
 * verschlüsselt gespeicherten Zugangsdaten (Passwort, Host/Port) – jeder Provider interpretiert es selbst.
 */
export interface MailSyncProvider {
  readonly id: "gmail" | "microsoft";
  readonly label: string;
  /** Environment Variables der FallFlow-App-Identität, die fehlen (leer = konfiguriert). Bei IMAP/SMTP immer leer. */
  missingConfig(): string[];
  /** Nur bei OAuth-Anbietern vorhanden. */
  refreshTokens?(refreshToken: string): Promise<RefreshedTokens>;
  /** Leichter Aufruf, um zu prüfen, ob die gespeicherten Zugangsdaten noch funktionieren. Wirft bei Fehler. */
  testConnection(tokens: ProviderTokens): Promise<void>;
  fetchNewMessages(tokens: ProviderTokens, sinceIso: string | null): Promise<InboundEmail[]>;
  sendReply(tokens: ProviderTokens, to: string, subject: string, body: string): Promise<void>;
}

/** Vollständiger OAuth-Adapter (FallFlow hat pro Anbieter eine App-Identität als Vercel-Variable). */
export interface EmailProvider extends MailSyncProvider {
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<ExchangeResult>;
  refreshTokens(refreshToken: string): Promise<RefreshedTokens>;
}
