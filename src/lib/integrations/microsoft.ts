import { IntegrationNotReadyError, type EmailProvider } from "./email";

const SCOPES = ["offline_access", "User.Read", "Mail.Read", "Mail.Send"];

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
  async exchangeCode() {
    // TODO (benötigt echte Azure-App-Credentials): POST /oauth2/v2.0/token, Tokens serverseitig verschlüsselt speichern.
    throw new IntegrationNotReadyError("Microsoft-Token-Austausch ist noch nicht implementiert.");
  },
  async fetchNewMessages() {
    // TODO: Microsoft Graph GET /me/mailFolders/inbox/messages bzw. Change Notifications (Webhook).
    throw new IntegrationNotReadyError("Microsoft-Abruf ist noch nicht implementiert.");
  },
  async sendReply() {
    // TODO: Microsoft Graph POST /me/sendMail
    throw new IntegrationNotReadyError("Microsoft-Versand ist noch nicht implementiert.");
  },
};
