import { gmailProvider } from "@/lib/integrations/gmail";
import { createOAuthRoute } from "@/lib/integrations/oauth-route";

export const { GET, POST } = createOAuthRoute(gmailProvider);
