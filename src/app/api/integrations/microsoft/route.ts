import { microsoftProvider } from "@/lib/integrations/microsoft";
import { createOAuthRoute } from "@/lib/integrations/oauth-route";

export const { GET, POST, DELETE } = createOAuthRoute(microsoftProvider);
