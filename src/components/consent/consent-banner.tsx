"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONSENT_EVENT, GOOGLE_ADS_ID, loadGoogleTag, OPEN_CONSENT_EVENT, readConsent, saveConsent, trackConversion } from "@/lib/tracking";

/** Seiten, auf denen nie ein Banner erscheint (eingebettetes Chat-Widget, Upload-Link für Endkunden, Betreiber-Bereich). */
const HIDDEN = /^\/(widget|upload|termin|admin)(\/|$)/;

/**
 * Cookie-Hinweis für Google Ads. Ohne Einwilligung wird kein Google-Code geladen. Erscheint nur, wenn Google Ads
 * eingerichtet ist; über „Cookie-Einstellungen“ im Footer lässt sich die Wahl jederzeit ändern.
 */
export function ConsentBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GOOGLE_ADS_ID) return;
    const choice = readConsent();
    if (choice === "granted") loadGoogleTag();
    // Erst nach dem ersten Rendern entscheiden (localStorage gibt es nur im Browser).
    const t = setTimeout(() => setOpen(choice === null), 0);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => {
      clearTimeout(t);
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    };
  }, []);

  if (!GOOGLE_ADS_ID || !open || HIDDEN.test(pathname)) return null;

  const choose = (choice: "granted" | "denied") => {
    setOpen(false);
    saveConsent(choice);
  };

  return (
    <div role="dialog" aria-label="Cookie-Einstellungen" className="fixed inset-x-0 bottom-0 z-50 p-2 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Wir verwenden Cookies, um unsere Website zu verbessern und die Wirkung unserer Werbung zu messen. Notwendige Cookies sind immer aktiv.{" "}
          <Link href="/datenschutz#cookies" className="underline">
            Mehr erfahren
          </Link>
        </p>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" size="sm" onClick={() => choose("denied")}>
            Ablehnen
          </Button>
          <Button size="sm" onClick={() => choose("granted")}>
            Akzeptieren
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Link „Cookie-Einstellungen“ (z. B. im Footer) – öffnet den Hinweis erneut. Ohne Google Ads nicht sichtbar. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  if (!GOOGLE_ADS_ID) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Cookie-Einstellungen
    </button>
  );
}

/** Rückkehr von der Stripe-Bezahlseite (?checkout=success): Testphase gestartet → Conversion. In <Suspense> einbinden. */
export function CheckoutConversion() {
  const success = useSearchParams().get("checkout") === "success";
  return success ? <ConversionPing kind="trial" /> : null;
}

/** Meldet beim Anzeigen einmalig eine Conversion (z. B. Registrierung). Wartet ggf. auf die Einwilligung. */
export function ConversionPing({ kind }: { kind: "signup" | "trial" }) {
  useEffect(() => {
    if (!GOOGLE_ADS_ID || trackConversion(kind)) return;
    // Noch keine Einwilligung: senden, sobald der Besucher im Banner zustimmt.
    const onConsent = () => trackConversion(kind);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [kind]);
  return null;
}
