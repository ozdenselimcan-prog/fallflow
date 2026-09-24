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

/**
 * Adapter-Schnittstelle für E-Mail-Postfächer. Neue Anbieter implementieren nur dieses Interface;
 * Dashboard und API-Routen kennen ausschließlich EmailProvider.
 */
export interface EmailProvider {
  readonly id: "gmail" | "microsoft";
  readonly label: string;
  /** Environment Variables, die für den echten OAuth-Betrieb fehlen (leer = konfiguriert). */
  missingConfig(): string[];
  /** URL, zu der der Benutzer für die OAuth-Zustimmung weitergeleitet wird. */
  getAuthUrl(state: string, redirectUri: string): string;
  /** Tauscht den OAuth-Code gegen Tokens. Tokens dürfen nur serverseitig gespeichert werden (nie im Client). */
  exchangeCode(code: string, redirectUri: string): Promise<{ account: string }>;
  fetchNewMessages(): Promise<InboundEmail[]>;
  sendReply(to: string, subject: string, body: string): Promise<void>;
}
