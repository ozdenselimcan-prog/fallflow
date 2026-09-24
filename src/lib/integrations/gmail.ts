import { IntegrationNotReadyError, type EmailProvider } from "./email";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "openid", "email"];

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
  async exchangeCode() {
    // TODO (benötigt echte Google-Credentials): POST https://oauth2.googleapis.com/token, Refresh-Token
    // serverseitig verschlüsselt speichern (channels.token_ref), Konto-E-Mail aus dem id_token lesen.
    throw new IntegrationNotReadyError("Gmail-Token-Austausch ist noch nicht implementiert.");
  },
  async fetchNewMessages() {
    // TODO: Gmail API users.messages.list/get bzw. Push via users.watch (Pub/Sub) anbinden.
    throw new IntegrationNotReadyError("Gmail-Abruf ist noch nicht implementiert.");
  },
  async sendReply() {
    // TODO: Gmail API users.messages.send
    throw new IntegrationNotReadyError("Gmail-Versand ist noch nicht implementiert.");
  },
};
