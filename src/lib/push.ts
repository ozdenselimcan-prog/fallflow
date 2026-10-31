import webpush from "web-push";
import type { Store } from "@/lib/data/store";

/**
 * Push-Benachrichtigungen aufs Handy bzw. in den Browser des Betriebs (Web Push, kostenlos): bei Notfällen und wenn ein
 * Kunde über den Buchungslink einen Termin gewählt hat. Die Geräte meldet der Betrieb unter KI-Assistent → Automatik an.
 * Schlüssel: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (ohne sie passiert nichts).
 */
export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface StoredPush extends PushSubscriptionJson {
  userId: string;
  createdAt: string;
}

export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function configure() {
  if (configured || !pushConfigured()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@fallflow.xyz", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export const pushSubscriptionsOf = (profile: { push?: StoredPush[] } | null | undefined) => profile?.push ?? [];

/** Benachrichtigung an alle angemeldeten Geräte des Betriebs; abgelaufene Anmeldungen werden entfernt. */
export async function sendPush(store: Store, message: { title: string; body: string; url: string }): Promise<number> {
  if (!pushConfigured()) return 0;
  configure();
  const company = await store.getCompany();
  const subs = pushSubscriptionsOf(company.businessProfile);
  if (!subs.length) return 0;
  const payload = JSON.stringify({ title: message.title.slice(0, 80), body: message.body.slice(0, 200), url: message.url });
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3600, urgency: "high" });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
        else console.error("[push] Versand fehlgeschlagen:", status ?? (err instanceof Error ? err.message : "unbekannt"));
      }
    }),
  );
  if (gone.length) {
    const fresh = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...fresh.businessProfile, push: pushSubscriptionsOf(fresh.businessProfile).filter((s) => !gone.includes(s.endpoint)) } });
  }
  return sent;
}
