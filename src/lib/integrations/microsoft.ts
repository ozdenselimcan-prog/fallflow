import { IntegrationNotReadyError, stripHtml, type EmailProvider, type InboundEmail, type ProviderTokens } from "./email";

const SCOPES = ["offline_access", "User.Read", "Mail.Read", "Mail.Send"];
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0/me";

async function graphFetch(path: string, tokens: ProviderTokens, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${tokens.accessToken}` } });
  if (!res.ok) throw new Error(`Microsoft-Graph-API antwortete mit HTTP ${res.status}`);
  return res.status === 202 || res.status === 204 ? null : res.json();
}

export const microsoftProvider: EmailProvider = {
  id: "microsoft",
  label: "Microsoft 365",
  missingConfig: () => ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"].filter((k) => !process.env[k]),
  getAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      response_mode: "query",
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  },
  async exchangeCode(code, redirectUri) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: process.env.MICROSOFT_CLIENT_ID ?? "", client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "", redirect_uri: redirectUri, grant_type: "authorization_code", scope: SCOPES.join(" ") }),
    });
    if (!res.ok) throw new IntegrationNotReadyError(`Microsoft-Token-Austausch fehlgeschlagen (HTTP ${res.status}).`);
    const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
    if (!body.refresh_token) throw new IntegrationNotReadyError("Microsoft hat keinen Refresh-Token geliefert.");
    const me = (await graphFetch("", { accessToken: body.access_token, refreshToken: null, expiresAt: null })) as { mail?: string; userPrincipalName?: string };
    return { account: me.mail || me.userPrincipalName || "", accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in };
  },
  async refreshTokens(refreshToken) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.MICROSOFT_CLIENT_ID ?? "", client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "", grant_type: "refresh_token", scope: SCOPES.join(" ") }),
    });
    if (!res.ok) throw new Error(`Microsoft-Token-Erneuerung fehlgeschlagen (HTTP ${res.status}).`);
    const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, expiresIn: body.expires_in };
  },
  async testConnection(tokens) {
    await graphFetch("", tokens);
  },
  async fetchNewMessages(tokens, sinceIso) {
    const since = sinceIso ?? new Date(Date.now() - 86_400_000).toISOString();
    // Nur der Posteingang (Standardordner). Massenmails erkennt Graph ohne Zusatzaufwand nicht – Filterung erfolgt zentral in mail-sync.ts.
    const q = `?$filter=receivedDateTime gt ${since}&$orderby=receivedDateTime&$top=20&$select=id,from,subject,bodyPreview,body,receivedDateTime`;
    const list = (await graphFetch(`/mailFolders/inbox/messages${q}`, tokens)) as {
      value?: { id: string; from?: { emailAddress?: { address?: string } }; subject?: string; body?: { content?: string; contentType?: string }; bodyPreview?: string; receivedDateTime: string }[];
    };
    return (list.value ?? []).map((m): InboundEmail => ({
      externalId: m.id,
      from: m.from?.emailAddress?.address ?? "",
      subject: m.subject ?? "",
      body: (m.body?.contentType === "html" ? stripHtml(m.body.content ?? "") : (m.body?.content ?? m.bodyPreview ?? "")).slice(0, 4000),
      receivedAt: m.receivedDateTime,
    }));
  },
  async sendReply(tokens, to, subject, body) {
    await graphFetch("/sendMail", tokens, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject, body: { contentType: "Text", content: body }, toRecipients: [{ emailAddress: { address: to } }] } }),
    });
  },
};
