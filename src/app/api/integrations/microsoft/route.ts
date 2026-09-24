import { microsoftProvider } from "@/lib/integrations/microsoft";
import { createOAuthRoute } from "@/lib/integrations/oauth-route";

export const { GET, POST } = createOAuthRoute(microsoftProvider);
