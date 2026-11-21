"use client";

import { LifeBuoy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

interface Access {
  active: boolean;
  until: string | null;
  lastUsedAt: string | null;
}

/**
 * „FallFlow richtet es für Sie ein“: Der Betrieb erlaubt dem Support für 7 Tage, sein Konto einzurichten – ohne sein
 * Passwort weiterzugeben (siehe lib/auth/support.ts). Jederzeit widerrufbar.
 */
export function SupportAccessCard({ canManage }: { canManage: boolean }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState("");
  const { pending, run } = useMutation();

  useEffect(() => {
    apiFetch<Access>("GET", "/api/support-access")
      .then(setAccess)
      .catch(() => setAccess({ active: false, until: null, lastUsedAt: null }));
  }, []);

  const change = async (method: "POST" | "DELETE") => {
    setError("");
    let failure = "";
    const res = await run(() =>
      apiFetch<Access>(method, "/api/support-access").catch((e: unknown) => {
        failure = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
        throw e;
      }),
    );
    if (res) setAccess(res);
    else setError(failure || "Speichern fehlgeschlagen.");
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <LifeBuoy className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Wir richten FallFlow für Sie ein</h2>
            <p className="text-sm text-muted-foreground">
              Keine Zeit oder keine Lust auf Einstellungen? Erlauben Sie unserem Support für 7 Tage den Zugriff – wir richten Leistungen, Texte und Vorlagen ein.
              Ihr Passwort brauchen wir dafür nicht.
            </p>
          </div>
        </div>
        {access?.active && <Badge tone="success">Erlaubt</Badge>}
      </div>
      {access && (
        <div className="mt-4 space-y-2">
          {access.active ? (
            <>
              <p className="text-sm">
                Support-Zugriff erlaubt bis <span className="font-medium">{formatDateTime(access.until!)}</span>
                {access.lastUsedAt && <span className="text-muted-foreground"> · zuletzt genutzt {formatDateTime(access.lastUsedAt)}</span>}
              </p>
              {canManage && (
                <Button variant="ghost" size="sm" loading={pending} onClick={() => change("DELETE")}>
                  Zugriff beenden
                </Button>
              )}
            </>
          ) : (
            canManage && (
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" loading={pending} onClick={() => change("POST")}>
                  Support-Zugriff erlauben (7 Tage)
                </Button>
                <Link href="/einrichtung" className="text-sm font-medium text-accent underline underline-offset-2">
                  Einrichtungstermin am Telefon buchen
                </Link>
              </div>
            )
          )}
          <p className="text-xs text-muted-foreground">Der Zugriff endet automatisch nach 7 Tagen und umfasst keine Abrechnung. Sie können ihn jederzeit beenden.</p>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </Card>
  );
}
