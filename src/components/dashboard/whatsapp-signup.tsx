"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<void> | null = null;
/** Facebook-SDK einmalig laden (erst beim Klick – keine Facebook-Skripte beim normalen Seitenaufruf). */
function loadSdk(appId: string): Promise<void> {
  sdkPromise ??= new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: false, xfbml: false, version: "v25.0" });
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/de_DE/sdk.js";
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("Facebook konnte nicht geladen werden"));
    };
    document.body.appendChild(s);
  });
  return sdkPromise;
}

/**
 * WhatsApp per Facebook verbinden (Meta Embedded Signup): Der Betrieb meldet sich an, wählt bzw. bestätigt seine Nummer –
 * FallFlow bekommt Telefonnummer-ID, Konto-ID und einen Code, der serverseitig gegen den Zugangstoken getauscht wird.
 */
export function WhatsAppSignup({ appId, configId, onDone }: { appId: string; configId: string; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await loadSdk(appId);
      const session: { phoneNumberId?: string; wabaId?: string } = {};
      const onMessage = (event: MessageEvent) => {
        if (!/facebook\.com$/.test(new URL(event.origin).hostname)) return;
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data?.type === "WA_EMBEDDED_SIGNUP" && data.event?.startsWith("FINISH")) {
            session.phoneNumberId = data.data?.phone_number_id;
            session.wabaId = data.data?.waba_id;
          }
        } catch {
          // andere Nachrichten von Facebook ignorieren
        }
      };
      window.addEventListener("message", onMessage);
      const code = await new Promise<string | null>((resolve) =>
        window.FB.login((res: any) => resolve(res?.authResponse?.code ?? null), {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
        }),
      );
      // Die Sitzungsdaten kommen manchmal kurz nach dem Code an.
      for (let i = 0; i < 20 && code && !session.phoneNumberId; i++) await new Promise((r) => setTimeout(r, 150));
      window.removeEventListener("message", onMessage);
      if (!code) throw new Error("Die Anmeldung wurde abgebrochen.");
      if (!session.phoneNumberId || !session.wabaId) throw new Error("Meta hat keine Nummer übermittelt. Bitte die Einrichtung bis zum Ende durchklicken.");
      await apiFetch("POST", "/api/integrations/whatsapp/embedded", { code, phoneNumberId: session.phoneNumberId, wabaId: session.wabaId });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verbindung fehlgeschlagen");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={start} loading={pending}>
        Mit Facebook verbinden
      </Button>
      <p className="text-xs text-muted-foreground">Sie melden sich bei Meta an und wählen bzw. bestätigen Ihre WhatsApp-Nummer – dauert etwa 2 Minuten.</p>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
