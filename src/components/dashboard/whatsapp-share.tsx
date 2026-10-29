"use client";

import { Check, Copy, Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Damit Kunden des Betriebs von seiner WhatsApp-Nummer erfahren: Direkt-Link (wa.me), QR-Code zum Ausdrucken und ein
 * fertiger Button für die eigene Website.
 */
export function WhatsAppShare({ number }: { number: string }) {
  const digits = number.replace(/\D/g, "");
  const link = `https://wa.me/${digits}?text=${encodeURIComponent("Hallo, ich habe eine Anfrage:")}`;
  const snippet = `<a href="${link}" target="_blank" rel="noopener" style="position:fixed;right:20px;bottom:88px;z-index:9998;display:flex;align-items:center;gap:8px;padding:12px 18px;border-radius:999px;background:#25D366;color:#fff;font:600 15px/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.2)">WhatsApp schreiben</a>`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState<"link" | "snippet" | null>(null);

  useEffect(() => {
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [link]);

  const copy = async (what: "link" | "snippet") => {
    await navigator.clipboard.writeText(what === "link" ? link : snippet).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div>
        <p className="font-medium">So erfahren Ihre Kunden davon</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Link in E-Mail-Signatur und Google-Profil, QR-Code auf Flyer, Visitenkarte oder Firmenwagen, Button auf Ihrer Website.</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        {qr && (
          <div className="flex shrink-0 flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR-Code: WhatsApp-Chat öffnen" className="size-36 rounded-lg border border-border bg-white" />
            <a href={qr} download="whatsapp-qr-code.png" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              <Download className="size-3.5" /> QR-Code herunterladen
            </a>
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Direkt-Link</p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{link}</code>
              <Button size="sm" variant="secondary" onClick={() => copy("link")} aria-label="Link kopieren">
                {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Button für Ihre Website (vor &lt;/body&gt; einfügen oder Ihrem Webdesigner schicken)</p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{snippet}</code>
              <Button size="sm" variant="secondary" onClick={() => copy("snippet")} aria-label="Code kopieren">
                {copied === "snippet" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
