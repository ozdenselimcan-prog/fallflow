export class IntegrationNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationNotReadyError";
  }
}

export interface InboundAttachment {
  filename: string;
  mime: string;
  bytes: Uint8Array;
}

export interface InboundEmail {
  externalId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  attachments: InboundAttachment[];
  /** Dateinamen von Anhängen, die nicht übernommen werden konnten (z. B. HEIC-Foto, Word-Datei, über 10 MB). */
  skippedAttachments?: string[];
  /** true = die Mail trägt selbst einen Auto-Antwort-Header (RFC 3834, z. B. "Auto-Submitted: auto-replied").
   * Verhindert Endlosschleifen mit Abwesenheitsnotizen oder einem ANDEREN automatisch antwortenden System
   * (z. B. einem anderen Energieberatungsbüro, das ebenfalls FallFlow nutzt). */
  autoSubmitted: boolean;
  /** Message-ID-Kopfzeile: bleibt gleich, wenn die Mail verschoben wird (z. B. aus dem Junk-Ordner in den Posteingang) –
   * verhindert, dass dieselbe Mail ein zweites Mal bearbeitet wird. */
  messageId?: string;
  /** true = lag im Junk-/Spam-Ordner des Postfachs. */
  junk?: boolean;
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

/** Übersetzt typische Fehler des Mail-Anbieters in einen verständlichen Hinweis für das Büro (sonst bleibt der Originaltext). */
export function friendlyMailError(message: string): string {
  if (/service abuse|ErrorAccountSuspend|Account suspended/i.test(message)) {
    return "Microsoft hat Ihr Postfach vorübergehend gesperrt (Verdacht auf Missbrauch – passiert vor allem bei neuen, privaten Outlook-Adressen). Bitte melden Sie sich im Browser bei Outlook an und bestätigen Sie Ihr Konto (meist per SMS-Code). Danach hier erneut „Mit Microsoft anmelden“ klicken.";
  }
  if (/ErrorExceededMessageLimit|limit exceeded/i.test(message)) {
    return "Ihr Postfach hat das Tageslimit für gesendete E-Mails erreicht (bei neuen Outlook-Adressen sehr niedrig, bis das Konto bestätigt ist). Bitte später erneut senden.";
  }
  if (/AADSTS(70000|700082|50173|50076|50079)|invalid_grant/i.test(message)) {
    return "Die Anmeldung bei Microsoft ist abgelaufen oder wurde zurückgesetzt (z. B. nach einer Passwortänderung). Bitte hier erneut „Mit Microsoft anmelden“ klicken.";
  }
  return message;
}

/** Grobe Text-Extraktion aus HTML-Mail-Inhalt (Tags entfernen, Whitespace normalisieren) – kein echter HTML-Parser. */
export const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Schnittstelle, die der Mail-Abruf (mail-sync.ts) und der Versand (outbound.ts) brauchen. */
export interface MailSyncProvider {
  readonly id: "gmail" | "microsoft";
  readonly label: string;
  /** Environment Variables der FallFlow-App-Identität, die fehlen (leer = konfiguriert). Bei IMAP/SMTP immer leer. */
  missingConfig(): string[];
  /** Nur bei OAuth-Anbietern vorhanden (Microsoft). */
  refreshTokens?(refreshToken: string): Promise<RefreshedTokens>;
  /** Leichter Aufruf, um zu prüfen, ob die gespeicherten Zugangsdaten noch funktionieren. Wirft bei Fehler. */
  testConnection(tokens: ProviderTokens): Promise<void>;
  fetchNewMessages(tokens: ProviderTokens, sinceIso: string | null): Promise<InboundEmail[]>;
  /** Mit `reply`: als Antwort auf diese eingegangene Mail senden (gleicher Gesprächsverlauf beim Kunden). */
  sendReply(tokens: ProviderTokens, to: string, subject: string, body: string, attachments?: InboundAttachment[], reply?: ReplyTarget): Promise<void>;
}

/** Die Mail des Kunden, auf die geantwortet wird. */
export interface ReplyTarget {
  /** Message-ID-Kopfzeile der Kunden-Mail (für In-Reply-To/References). */
  messageId?: string;
  /** ID der Mail beim Anbieter (Microsoft Graph), um direkt darauf zu antworten. */
  providerMessageId?: string;
  /** Betreff der Kunden-Mail. */
  subject: string;
}

/** Betreff einer Antwort: "Re: <Betreff des Kunden>" – ohne Betreff des Kunden der vorgesehene Betreff. */
export const replySubject = (original: string, fallback: string) => {
  const s = original.trim();
  if (!s) return fallback;
  return /^(re|aw|antw)\s*:/i.test(s) ? s : `Re: ${s}`;
};
