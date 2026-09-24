import { apiError, json, parseBody, publicRoute } from "@/lib/api";
import { getPublicStore } from "@/lib/data";
import { widgetSessionSchema } from "@/lib/validation";

/** Liefert dem Widget nur die öffentlich sichtbaren Assistenten-Einstellungen. */
export const POST = publicRoute("widget-session", 60, async (req) => {
  const body = await parseBody(req, widgetSessionSchema);
  if (!body.ok) return body.res;
  const store = await getPublicStore(body.data.companyId);
  if (!store) return apiError("Unbekannte Company", 404);
  const [assistant, company] = await Promise.all([store.getAssistant(), store.getCompany()]);
  return json({
    assistantName: assistant.name,
    greeting: assistant.greeting,
    companyName: company.name,
    appointmentBooking: assistant.appointmentBooking,
  });
});
