"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONSENT_EVENT, loadTrackingTags, OPEN_CONSENT_EVENT, readConsent, saveConsent, trackConversion, trackPageView, TRACKING_ENABLED } from "@/lib/tracking";

/** Seiten, auf denen nie ein Banner erscheint (eingebettetes Chat-Widget, Upload-Link für Endkunden, Betreiber-Bereich). */
const HIDDEN = /^\/(widget|upload|termin|admin)(\/|$)/;

/**
 * Cookie-Hinweis für Google Ads. Ohne Einwilligung wird kein Google-Code geladen. Erscheint nur, wenn Google Ads
 * eingerichtet ist; über „Cookie-Einstellungen“ im Footer lässt sich die Wahl jederzeit ändern.
 */
export function ConsentBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const visible = TRACKING_ENABLED && open && !HIDDEN.test(pathname);

  // Solange der Hinweis offen ist, bekommt die Seite unten so viel Platz, dass er keine Knöpfe (z. B. „Weiter“) verdeckt.
  useEffect(() => {
    const el = box.current;
    if (!visible || !el) return;
    const apply = () => (document.body.style.paddingBottom = `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  useEffect(() => {
    // Im eingebetteten Widget, auf Kunden-Links und im Admin-Bereich nie fremden Code laden.
    if (!TRACKING_ENABLED || HIDDEN.test(window.location.pathname)) return;
    const choice = readConsent();
    if (choice === "granted") loadTrackingTags();
    // Erst nach dem ersten Rendern entscheiden (localStorage gibt es nur im Browser).
    const t = setTimeout(() => setOpen(choice === null), 0);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => {
      clearTimeout(t);
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    };
  }, []);

  // Seitenaufruf für Meta – nur auf öffentlichen Seiten (nicht im Dashboard und nie im eingebetteten Widget).
  useEffect(() => {
    if (!TRACKING_ENABLED || HIDDEN.test(pathname) || /^\/(dashboard|onboarding)(\/|$)/.test(pathname)) return;
    trackPageView();
    window.addEventListener(CONSENT_EVENT, trackPageView);
    return () => window.removeEventListener(CONSENT_EVENT, trackPageView);
  }, [pathname]);

  if (!visible) return null;

  const choose = (choice: "granted" | "denied") => {
    setOpen(false);
    saveConsent(choice);
  };

  return (
    <div ref={box} role="dialog" aria-label="Cookie-Einstellungen" className="fixed inset-x-0 bottom-0 z-50 p-2 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="sm:hidden">Cookies für Werbemessung erlauben? Notwendige sind immer aktiv.</span>
          <span className="hidden sm:inline">Wir verwenden Cookies, um unsere Website zu verbessern und die Wirkung unserer Werbung zu messen. Notwendige Cookies sind immer aktiv.</span>{" "}
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

/** Link „Cookie-Einstellungen“ (z. B. im Footer) – öffnet den Hinweis erneut. Ohne Werbe-Tracking nicht sichtbar. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  if (!TRACKING_ENABLED) return null;
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
    if (!TRACKING_ENABLED || trackConversion(kind)) return;
    // Noch keine Einwilligung: senden, sobald der Besucher im Banner zustimmt.
    const onConsent = () => trackConversion(kind);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [kind]);
  return null;
}
