import { IntegrationNotReadyError, stripHtml, type InboundAttachment, type InboundEmail, type MailSyncProvider, type ProviderTokens, type RefreshedTokens } from "./email";

/**
 * E-Mail-Verbindung über "Mit Microsoft anmelden" (OAuth + Microsoft Graph) – für Outlook / Microsoft 365, wo
 * IMAP mit App-Passwort bei vielen Firmenkonten abgeschaltet ist. FallFlow hat dafür EINE App-Registrierung bei
 * Microsoft (MICROSOFT_CLIENT_ID/SECRET); die Zugangsdaten des jeweiligen Postfachs liegen verschlüsselt in
 * `connections`. Abruf und Versand laufen ausschließlich automatisiert.
 */

const SCOPES = ["offline_access", "openid", "email", "User.Read", "Mail.Read", "Mail.Send"];
const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0/me";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
/** Eigener Kennzeichnungs-Header für automatisch versendete Mails (Graph erlaubt nur "X-"-Header, kein Auto-Submitted). */
export const AUTO_HEADER = "X-FallFlow-Auto";

async function graphFetch<T>(path: string, tokens: ProviderTokens, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${GRAPH}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${tokens.accessToken}` } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Microsoft antwortete mit HTTP ${res.status}${detail ? ` (${detail.slice(0, 160)})` : ""}`);
  }
  return res.status === 202 || res.status === 204 ? null : ((await res.json()) as T);
}

async function tokenRequest(params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID ?? "", client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "", scope: SCOPES.join(" "), ...params }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error_description?: string };
    throw new IntegrationNotReadyError(`Microsoft-Anmeldung fehlgeschlagen (HTTP ${res.status})${body.error_description ? `: ${body.error_description.split("\r")[0]}` : ""}`);
  }
  return res.json();
}

interface GraphMessage {
  id: string;
  internetMessageId?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  subject?: string;
  body?: { content?: string; contentType?: string };
  receivedDateTime: string;
  hasAttachments?: boolean;
  internetMessageHeaders?: { name: string; value: string }[];
}

interface GraphAttachment {
  "@odata.type"?: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  contentBytes?: string;
}

const isPdf = (a: GraphAttachment) => a.contentType === "application/pdf" || /\.pdf$/i.test(a.name ?? "");

export const microsoftProvider: MailSyncProvider & {
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<{ account: string; accessToken: string; refreshToken: string; expiresIn: number }>;
} = {
  id: "microsoft",
  label: "Microsoft 365 / Outlook",
  missingConfig: () => ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"].filter((k) => !process.env[k]),

  getAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: SCOPES.join(" "),
      prompt: "select_account",
      state,
    });
    return `${AUTH_URL}?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const body = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
    if (!body.refresh_token) throw new IntegrationNotReadyError("Microsoft hat keinen dauerhaften Zugriff erteilt (kein Refresh-Token).");
    const me = await graphFetch<{ mail?: string; userPrincipalName?: string }>("", { accessToken: body.access_token, refreshToken: null, expiresAt: null });
    return { account: (me?.mail || me?.userPrincipalName || "").toLowerCase(), accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in };
  },

  async refreshTokens(refreshToken): Promise<RefreshedTokens> {
    const body = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, expiresIn: body.expires_in };
  },

  async testConnection(tokens) {
    await graphFetch("/mailFolders/inbox?$select=id", tokens);
  },

  async fetchNewMessages(tokens, sinceIso) {
    // Etwas Überlappung, damit keine Mail zwischen zwei Abrufen verloren geht – doppelte erkennt mail-sync.ts (seenIds).
    const since = new Date((sinceIso ? Date.parse(sinceIso) : Date.now() - 86_400_000) - 60 * 60_000).toISOString();
    const query = new URLSearchParams({
      $filter: `receivedDateTime ge ${since}`,
      $orderby: "receivedDateTime asc",
      $top: "25",
      $select: "id,internetMessageId,from,subject,body,receivedDateTime,hasAttachments,internetMessageHeaders",
    });
    const read = async (folder: string) =>
      (await graphFetch<{ value?: GraphMessage[] }>(`/mailFolders/${folder}/messages?${query}`, tokens, { headers: { Prefer: 'outlook.body-content-type="text"' } }))?.value ?? [];
    const inbox = await read("inbox");
    // Zusätzlich den Junk-Ordner: Kundenanfragen landen dort manchmal fälschlich (siehe mail-sync.ts).
    const junk = await read("junkemail").catch((err) => {
      console.error("[microsoft] Junk-Ordner konnte nicht gelesen werden:", err instanceof Error ? err.message : "unbekannt");
      return [] as GraphMessage[];
    });
    const out: InboundEmail[] = [];
    for (const [m, isJunk] of [...inbox.map((m) => [m, false] as const), ...junk.map((m) => [m, true] as const)]) {
      const headers = new Map((m.internetMessageHeaders ?? []).map((h) => [h.name.toLowerCase(), h.value]));
      const autoSubmittedHeader = headers.get("auto-submitted");
      const autoSubmitted = (autoSubmittedHeader !== undefined && autoSubmittedHeader.toLowerCase() !== "no") || headers.has(AUTO_HEADER.toLowerCase());

      const attachments: InboundAttachment[] = [];
      const skippedAttachments: string[] = [];
      if (m.hasAttachments) {
        const atts = await graphFetch<{ value?: GraphAttachment[] }>(`/messages/${encodeURIComponent(m.id)}/attachments`, tokens);
        for (const a of atts?.value ?? []) {
          if (a["@odata.type"] !== "#microsoft.graph.fileAttachment" || !a.contentBytes) continue;
          const size = a.size ?? 0;
          const pdf = isPdf(a);
          const image = ACCEPTED_IMAGES.includes(a.contentType ?? "") && !a.isInline && size >= 20_000;
          if ((pdf || image) && size <= MAX_ATTACHMENT_BYTES) {
            attachments.push({ filename: a.name || (pdf ? "dokument.pdf" : "foto"), mime: pdf ? "application/pdf" : (a.contentType ?? "application/octet-stream"), bytes: new Uint8Array(Buffer.from(a.contentBytes, "base64")) });
          } else if (!a.isInline && size >= 20_000) {
            // Bewusst angehängt, aber nicht übernehmbar (HEIC, Word, über 10 MB …) – Hinweis in der Fallakte.
            skippedAttachments.push(a.name || "Datei ohne Namen");
          }
        }
      }

      const sender = m.from?.emailAddress;
      out.push({
        externalId: m.id,
        messageId: m.internetMessageId || undefined,
        junk: isJunk,
        from: sender?.name ? `${sender.name} <${sender.address ?? ""}>` : (sender?.address ?? ""),
        subject: m.subject ?? "",
        body: (m.body?.contentType === "html" ? stripHtml(m.body.content ?? "") : (m.body?.content ?? "")).slice(0, 4000),
        receivedAt: m.receivedDateTime,
        attachments,
        skippedAttachments,
        autoSubmitted,
      });
    }
    return out;
  },

  async sendReply(tokens, to, subject, body, attachments) {
    await graphFetch("/sendMail", tokens, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
          internetMessageHeaders: [{ name: AUTO_HEADER, value: "auto-replied" }],
          attachments: (attachments ?? []).map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.filename, contentType: a.mime, contentBytes: Buffer.from(a.bytes).toString("base64") })),
        },
        saveToSentItems: true,
      }),
    });
  },
};
