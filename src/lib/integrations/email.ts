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
 * Adapter-Schnittstelle für E-Mail-Postfächer. FallFlow hat pro Anbieter genau eine App-Identität
 * (GOOGLE_CLIENT_ID/SECRET bzw. MICROSOFT_CLIENT_ID/SECRET als Vercel-Variablen). Die Zugangsdaten
 * jedes einzelnen Kunden-Postfachs werden separat pro Büro in `connections` gespeichert (siehe
 * connections-store.ts) und hier als ProviderTokens hereingereicht – nie global, nie im Client.
 */
export interface EmailProvider {
  readonly id: "gmail" | "microsoft";
  readonly label: string;
  /** Environment Variables der FallFlow-App-Identität, die fehlen (leer = konfiguriert). */
  missingConfig(): string[];
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<ExchangeResult>;
  refreshTokens(refreshToken: string): Promise<RefreshedTokens>;
  /** Leichter Aufruf, um zu prüfen, ob die gespeicherten Zugangsdaten noch funktionieren. Wirft bei Fehler. */
  testConnection(tokens: ProviderTokens): Promise<void>;
  fetchNewMessages(tokens: ProviderTokens, sinceIso: string | null): Promise<InboundEmail[]>;
  sendReply(tokens: ProviderTokens, to: string, subject: string, body: string): Promise<void>;
}
