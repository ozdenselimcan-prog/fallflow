"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import type { WhatsAppRequestRow } from "@/lib/admin/overview";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

const IN_APP = { yes: "läuft in der Business-App", no: "nicht in der App", unknown: "weiß nicht" } as const;
const APP = { business: "WhatsApp Business", personal: "normales WhatsApp – muss umsteigen", none: "noch kein WhatsApp" } as const;

/** Betreiber: WhatsApp-Freischaltungen – Betrieb in der Meta-App als Tester eintragen, dann hier freigeben. */
export function WhatsAppRequests({ rows }: { rows: WhatsAppRequestRow[] }) {
  const { pending, error, run } = useMutation();
  const [busy, setBusy] = useState<string | null>(null);
  if (!rows.length) return null;
  const approve = async (companyId: string) => {
    setBusy(companyId);
    await run(() => apiFetch("POST", "/api/admin/whatsapp-access", { companyId }));
    setBusy(null);
  };
  return (
    <Card className="mt-4">
      <CardHeader
        title="WhatsApp-Freischaltungen"
        description="1. Meta-App → App-Rollen → Rollen → „Tester hinzufügen“ (Facebook-Profil des Betriebs). 2. Hier „Freigeschaltet“ klicken – dann sieht der Betrieb den Verbinden-Knopf."
      />
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => (
          <li key={r.companyId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                {r.company} <span className="font-normal text-muted-foreground">· {formatDateTime(r.request.requestedAt)}</span>
              </p>
              <p className="text-muted-foreground">
                {r.request.name} · Facebook: <span className="break-all text-foreground">{r.request.facebook}</span>
              </p>
              <p className="text-muted-foreground">
                WhatsApp: {r.request.phone} ({r.request.app ? APP[r.request.app] : IN_APP[r.request.inApp]}) · Rückfragen: {r.request.contact}
              </p>
            </div>
            {r.request.status === "approved" ? (
              <Badge tone="success">Freigeschaltet</Badge>
            ) : (
              <Button size="sm" onClick={() => approve(r.companyId)} loading={pending && busy === r.companyId}>
                Freigeschaltet
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="px-5 pb-3 text-xs text-danger">{error}</p>}
    </Card>
  );
}
