"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

interface Status {
  available: boolean;
  calendar: { status: string; account: string; lastError: string } | null;
}

/** Outlook-Kalender verbinden: belegte Zeiten bei Terminvorschlägen auslassen, bestätigte Termine eintragen. */
export function CalendarCard({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<Status | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Status>("GET", "/api/integrations/microsoft")
      .then(setS)
      .catch(() => setS({ available: false, calendar: null }));
  }, []);

  const connect = async () => {
    setPending(true);
    setError(null);
    try {
      const { authUrl } = await apiFetch<{ authUrl: string }>("POST", "/api/integrations/microsoft", { purpose: "calendar", returnTo: "/dashboard/settings/connections" });
      window.location.assign(authUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verbindung konnte nicht gestartet werden");
      setPending(false);
    }
  };
  const disconnect = async () => {
    setPending(true);
    await apiFetch("DELETE", "/api/integrations/microsoft?purpose=calendar").catch(() => {});
    setS((x) => (x ? { ...x, calendar: null } : x));
    setPending(false);
  };

  const connected = s?.calendar?.status === "connected";
  return (
    <Card className="mt-4">
      <CardHeader
        title="Outlook-Kalender"
        description="Termine, die in Ihrem Outlook-Kalender schon belegt sind, schlägt FallFlow nicht vor. Bestätigte Termine trägt FallFlow automatisch in Outlook ein."
        action={connected ? <Badge tone="success">Verbunden</Badge> : s?.calendar ? <Badge tone="warning">Fehler</Badge> : <Badge>Nicht verbunden</Badge>}
      />
      <div className="space-y-3 p-5 text-sm">
        {error && <Notice tone="error">{error}</Notice>}
        {s?.calendar?.lastError && <Notice tone="error">{s.calendar.lastError}</Notice>}
        {connected && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden /> {s?.calendar?.account}
          </p>
        )}
        {s && !s.available && <p className="text-muted-foreground">Die Anmeldung über Microsoft ist für diese Installation noch nicht eingerichtet.</p>}
        {s?.available && canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={connect} loading={pending} variant={connected ? "secondary" : "primary"}>
              {connected ? "Neu verbinden" : "Mit Microsoft anmelden"}
            </Button>
            {s.calendar && (
              <Button variant="ghost" onClick={disconnect} disabled={pending}>
                Trennen
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
