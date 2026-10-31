import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";
import { chatTextDefaults } from "@/lib/ai/conversation";
import { CUSTOMER_TEXTS, TEXT_GROUPS, cleanTexts } from "@/lib/config/customer-texts";
import { APPOINTMENT_PLACEHOLDER } from "@/lib/intake/scheduling";

/** Alle automatischen Kundentexte mit Standard und eigener Fassung (Seite „KI-Assistent → Texte“). */
export const GET = withSession(async (_req, { store }) => {
  const [company, settings] = await Promise.all([store.getCompany(), store.getAssistant()]);
  const own = company.businessProfile.texts ?? {};
  // Chat-Standards hängen vom gewählten Tonfall ab; die Terminbestätigung kam früher aus den Assistent-Einstellungen.
  const toneDefaults = chatTextDefaults(settings.tone);
  const legacyConfirmed = settings.appointmentConfirmedTemplate?.trim().replace(APPOINTMENT_PLACEHOLDER, "{termin}");
  return json({
    groups: TEXT_GROUPS,
    texts: CUSTOMER_TEXTS.map((t) => ({
      ...t,
      default: toneDefaults[t.key] ?? (t.key === "appointment.confirmed" && legacyConfirmed ? legacyConfirmed : t.default),
      value: own[t.key] ?? "",
    })),
  });
});

const schema = z.object({ texts: z.record(z.string().max(80), z.string().max(2000)) });

/** Eigene Fassungen speichern – leer bzw. gleich dem Standard = Standard verwenden. */
export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const company = await store.getCompany();
    const texts = cleanTexts(body.data.texts);
    await store.updateCompany({ businessProfile: { ...company.businessProfile, texts } });
    return json({ ok: true, saved: Object.keys(texts).length });
  },
  { permission: "assistant:manage" },
);
