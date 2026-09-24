"use client";

import { Globe, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import type { Channel, ChannelKind } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { WidgetSnippet } from "./widget-snippet";

const META: Record<ChannelKind, { title: string; text: string; icon: typeof Globe }> = {
  website: { title: "Website", text: "Chat-Widget auf Ihrer Website.", icon: Globe },
  gmail: { title: "Google Gmail", text: "Anfragen aus Ihrem Gmail-Postfach übernehmen.", icon: Mail },
  microsoft: { title: "Microsoft 365", text: "Anfragen aus Outlook/Microsoft 365 übernehmen.", icon: Mail },
  whatsapp: { title: "WhatsApp", text: "WhatsApp Business ist als Kanal vorbereitet.", icon: MessageCircle },
};

interface ConnectResponse {
  mode: "mock" | "live";
  authUrl?: string;
  message?: string;
}

export function ChannelCards({ channels, appUrl, companyId, canManage }: { channels: Channel[]; appUrl: string; companyId: string; canManage: boolean }) {
  const { pending, run } = useMutation();
  const [messages, setMessages] = useState<Partial<Record<ChannelKind, string>>>({});

  const connect = async (kind: "gmail" | "microsoft") => {
    const res = await run(() => apiFetch<ConnectResponse>("POST", `/api/integrations/${kind}`), { refresh: false });
    if (!res) return setMessages((m) => ({ ...m, [kind]: "Die Verbindung konnte nicht gestartet werden." }));
    if (res.mode === "live" && res.authUrl) window.location.assign(res.authUrl);
    else setMessages((m) => ({ ...m, [kind]: res.message ?? "Nicht konfiguriert." }));
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {channels.map((c) => {
        const { title, text, icon: Icon } = META[c.kind];
        return (
          <Card key={c.kind} className={`p-5 ${c.kind === "website" ? "md:col-span-2" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
              {c.status === "connected" && <Badge tone="success">● Verbunden</Badge>}
              {c.status === "disconnected" && <Badge>○ Nicht verbunden</Badge>}
              {c.status === "coming_soon" && <Badge>Coming soon</Badge>}
            </div>

            {c.kind === "website" && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Fügen Sie diesen Code vor dem schließenden &lt;/body&gt;-Tag Ihrer Website ein:</p>
                <WidgetSnippet appUrl={appUrl} companyId={companyId} />
              </div>
            )}

            {(c.kind === "gmail" || c.kind === "microsoft") && (
              <div className="mt-4 space-y-3">
                <Button variant="secondary" size="sm" disabled={!canManage || c.status === "connected"} loading={pending} onClick={() => connect(c.kind as "gmail" | "microsoft")}>
                  Verbinden
                </Button>
                {messages[c.kind] && <Notice>{messages[c.kind]}</Notice>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
