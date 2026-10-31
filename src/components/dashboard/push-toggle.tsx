"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

/** VAPID-Schlüssel (Base64url) → Uint8Array für pushManager.subscribe. */
function keyBytes(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "unavailable" | "off" | "on" | "denied" | "ios-home";

/** Benachrichtigungen auf diesem Gerät (Handy/Browser) ein- und ausschalten – Notfälle und gebuchte Termine. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(ios && !standalone ? "ios-home" : "unsupported");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      const info = await apiFetch<{ available: boolean; publicKey: string; subscribed: boolean }>("GET", `/api/push?endpoint=${encodeURIComponent(sub?.endpoint ?? "")}`);
      setPublicKey(info.publicKey);
      if (!info.available) return setState("unavailable");
      if (Notification.permission === "denied") return setState("denied");
      setState(info.subscribed ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
      await apiFetch("POST", "/api/push", sub.toJSON());
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Einschalten fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiFetch("DELETE", `/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 font-medium">
        <Bell className="size-4 text-accent" /> Benachrichtigungen auf diesem Gerät
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Bei Notfällen und wenn ein Kunde einen Termin gebucht hat, meldet sich FallFlow sofort – auch wenn die Seite geschlossen ist.</p>
      <div className="mt-3">
        {state === "loading" && <p className="text-xs text-muted-foreground">Wird geprüft …</p>}
        {state === "off" && (
          <Button size="sm" onClick={enable} loading={busy}>
            <Bell className="size-4" /> Einschalten
          </Button>
        )}
        {state === "on" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-success">Eingeschaltet</span>
            <Button size="sm" variant="ghost" onClick={disable} loading={busy}>
              <BellOff className="size-4" /> Ausschalten
            </Button>
          </div>
        )}
        {state === "denied" && <p className="text-xs text-warning">Benachrichtigungen sind in den Browser-Einstellungen für diese Seite blockiert. Bitte dort erlauben.</p>}
        {state === "ios-home" && (
          <p className="text-xs text-muted-foreground">
            Auf dem iPhone: in Safari auf <strong>Teilen</strong> → <strong>Zum Home-Bildschirm</strong> tippen, FallFlow von dort öffnen und hier einschalten.
          </p>
        )}
        {state === "unsupported" && <p className="text-xs text-muted-foreground">Dieser Browser unterstützt keine Benachrichtigungen.</p>}
        {state === "unavailable" && <p className="text-xs text-muted-foreground">Benachrichtigungen werden gerade eingerichtet.</p>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </div>
  );
}
