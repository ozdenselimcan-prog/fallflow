"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

const RESULTS: Record<string, { tone: "success" | "error"; text: string }> = {
  "whatsapp-connected": { tone: "success", text: "WhatsApp ist verbunden." },
  "whatsapp-denied": { tone: "error", text: "Die Anmeldung bei Meta wurde abgebrochen." },
  "whatsapp-error": { tone: "error", text: "Die Anmeldung bei Meta hat nicht geklappt. Bitte noch einmal versuchen." },
  "whatsapp-failed": { tone: "error", text: "Die Verbindung zu WhatsApp konnte nicht hergestellt werden. Bitte noch einmal versuchen." },
  "whatsapp-no-number": { tone: "error", text: "In Ihrem WhatsApp-Konto wurde keine Nummer gefunden. Bitte die Einrichtung noch einmal durchklicken und eine Nummer auswählen." },
};

/**
 * WhatsApp per Facebook verbinden (Meta Embedded Signup per Weiterleitung): Der Betrieb meldet sich bei Meta an, wählt
 * bzw. bestätigt seine Nummer und kommt zurück – den Rest (Token, Nummer, Freischaltung) erledigt der Server.
 */
export function WhatsAppSignup() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Rückmeldung nach der Anmeldung (?integration=whatsapp-…) anzeigen.
  useEffect(() => {
    const result = RESULTS[new URLSearchParams(window.location.search).get("integration") ?? ""];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach der Rückleitung
    if (result) setNotice(result);
  }, []);

  const start = async () => {
    setPending(true);
    setNotice(null);
    try {
      const res = await apiFetch<{ authUrl: string }>("POST", "/api/integrations/whatsapp/embedded", { returnTo: window.location.pathname });
      window.location.href = res.authUrl;
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Anmeldung konnte nicht gestartet werden." });
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={start} loading={pending}>
        Mit Facebook verbinden
      </Button>
      <p className="text-xs text-muted-foreground">Sie melden sich bei Meta an und wählen bzw. bestätigen Ihre WhatsApp-Nummer – dauert etwa 2 Minuten.</p>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </div>
  );
}
