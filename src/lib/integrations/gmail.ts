import { IntegrationNotReadyError, stripHtml, type EmailProvider, type InboundEmail, type ProviderTokens } from "./email";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "openid", "email"];
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function googleFetch(path: string, tokens: ProviderTokens, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${tokens.accessToken}` } });
  if (!res.ok) throw new Error(`Gmail-API antwortete mit HTTP ${res.status}`);
  return res.json();
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const decodeB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function headerValue(headers: { name: string; value: string }[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

/** Sucht im MIME-Body rekursiv nach dem ersten text/plain-Teil (Fallback: text/html ohne Tags). */
export function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return "";
  const stack: GmailPart[] = [payload];
  let html = "";
  while (stack.length) {
    const p = stack.shift()!;
    if (p.mimeType === "text/plain" && p.body?.data) return decodeB64url(p.body.data);
    if (p.mimeType === "text/html" && p.body?.data && !html) html = decodeB64url(p.body.data);
    if (p.parts) stack.push(...p.parts);
  }
  return stripHtml(html);
}

export const gmailProvider: EmailProvider = {
  id: "gmail",
  label: "Google Gmail",
  missingConfig: () => ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter((k) => !process.env[k]),
  getAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  async exchangeCode(code, redirectUri) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!res.ok) throw new IntegrationNotReadyError(`Google-Token-Austausch fehlgeschlagen (HTTP ${res.status}).`);
    const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
    if (!body.refresh_token) {
      throw new IntegrationNotReadyError("Google hat keinen Refresh-Token geliefert. Bitte die Verbindung in den Google-Kontoeinstellungen entfernen und erneut verbinden.");
    }
    const profile = await googleFetch("/profile", { accessToken: body.access_token, refreshToken: null, expiresAt: null });
    return { account: (profile as { emailAddress?: string }).emailAddress ?? "", accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in };
  },
  async refreshTokens(refreshToken) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", grant_type: "refresh_token" }),
    });
    if (!res.ok) throw new Error(`Google-Token-Erneuerung fehlgeschlagen (HTTP ${res.status}).`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    return { accessToken: body.access_token, refreshToken: null, expiresIn: body.expires_in };
  },
  async testConnection(tokens) {
    await googleFetch("/profile", tokens);
  },
  async fetchNewMessages(tokens, sinceIso) {
    const afterSeconds = Math.floor(new Date(sinceIso ?? Date.now() - 86_400_000).getTime() / 1000);
    // Nur der Posteingang, keine gesendeten/entworfenen/als Spam markierten Mails – sonst würden eigene Antworten erneut als Kundenanfrage einlaufen.
    const list = (await googleFetch(`/messages?q=${encodeURIComponent(`in:inbox after:${afterSeconds} -label:CHAT -label:SPAM`)}&maxResults=20`, tokens)) as { messages?: { id: string }[] };
    const out: InboundEmail[] = [];
    for (const m of list.messages ?? []) {
      const full = (await googleFetch(`/messages/${m.id}?format=full`, tokens)) as {
        id: string;
        internalDate?: string;
        payload?: GmailPart & { headers?: { name: string; value: string }[] };
      };
      const headers = full.payload?.headers;
      // Automatische Mails (Newsletter, Abwesenheitsnotizen, Massenmails) sind keine Kundenanfragen.
      if (headerValue(headers, "List-Unsubscribe") || headerValue(headers, "Auto-Submitted").toLowerCase().startsWith("auto-") || headerValue(headers, "Precedence").toLowerCase() === "bulk") continue;
      out.push({
        externalId: full.id,
        from: headerValue(headers, "From"),
        subject: headerValue(headers, "Subject"),
        body: extractBody(full.payload).slice(0, 4000),
        receivedAt: full.internalDate ? new Date(Number(full.internalDate)).toISOString() : new Date().toISOString(),
      });
    }
    return out;
  },
  async sendReply(tokens, to, subject, body) {
    const raw = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
    await googleFetch("/messages/send", tokens, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64url(raw) }) });
  },
};
