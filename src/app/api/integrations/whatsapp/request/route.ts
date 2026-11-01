import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";
import { notifyPlatformAdmins } from "@/lib/admin/notify";
import { siteConfig } from "@/lib/config/site";
import type { WhatsAppAccessRequest } from "@/lib/data/types";

const schema = z.object({
  name: z.string().trim().min(2, "Bitte Ihren Namen angeben").max(120),
  facebook: z.string().trim().min(3, "Bitte Ihr Facebook-Profil angeben (Link oder Name)").max(300),
  phone: z.string().trim().min(5, "Bitte die WhatsApp-Nummer angeben").max(40),
  contact: z.string().trim().min(5, "Bitte eine E-Mail-Adresse oder Telefonnummer für Rückfragen angeben").max(200),
  app: z.enum(["business", "personal", "none"], { message: "Bitte angeben, welches WhatsApp Sie nutzen" }),
});

/** Betrieb fragt die WhatsApp-Freischaltung an (siehe lib/whatsapp-access.ts) – die Betreiber werden benachrichtigt. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const company = await store.getCompany();
    const request: WhatsAppAccessRequest = { ...body.data, inApp: body.data.app === "business" ? "yes" : "no", requestedAt: new Date().toISOString(), status: "open" };
    await store.updateCompany({ businessProfile: { ...company.businessProfile, whatsappRequest: request } });
    const app = { business: "WhatsApp Business (App bleibt nutzbar)", personal: "normales WhatsApp – muss vorher auf WhatsApp Business umsteigen", none: "noch kein WhatsApp auf der Nummer" }[body.data.app];
    await notifyPlatformAdmins({
      subject: `WhatsApp-Freischaltung: ${company.name}`,
      text: [
        `${company.name} möchte WhatsApp verbinden.`,
        `Name: ${body.data.name}`,
        `Facebook: ${body.data.facebook}`,
        `WhatsApp-Nummer: ${body.data.phone} (${app})`,
        `Rückfragen: ${body.data.contact}`,
        "",
        "1. Meta-App → App-Rollen → Rollen → Tester hinzufügen (Facebook-Profil oben).",
        `2. Danach in der Betreiber-Übersicht auf „Freigeschaltet“ klicken: ${siteConfig.appUrl}/admin`,
      ].join("\n"),
      url: "/admin",
    }).catch(() => {});
    return json({ request }, 201);
  },
  { permission: "company:manage", limit: 5 },
);
