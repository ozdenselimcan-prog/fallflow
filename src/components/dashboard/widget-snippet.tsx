"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function widgetCode(appUrl: string, companyId: string) {
  return `<script\n  src="${appUrl}/widget.js"\n  data-company-id="${companyId}">\n</script>`;
}

export function WidgetSnippet({ appUrl, companyId }: { appUrl: string; companyId: string }) {
  const [copied, setCopied] = useState(false);
  const code = widgetCode(appUrl, companyId);

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-foreground p-4 pr-24 font-mono text-xs leading-relaxed text-background">{code}</pre>
      <Button
        variant="secondary"
        size="sm"
        className="absolute right-3 top-3"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* Zwischenablage nicht verfügbar – Code bleibt markierbar */
          }
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Kopiert" : "Kopieren"}
      </Button>
    </div>
  );
}
