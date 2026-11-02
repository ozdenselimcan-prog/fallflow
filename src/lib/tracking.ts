"use client";

/**
 * Werbe-Tracking (Google Ads, Meta-Pixel) – nur nach ausdrücklicher Einwilligung (§ 25 TDDDG). Ohne
 * NEXT_PUBLIC_GOOGLE_ADS_ID und NEXT_PUBLIC_META_PIXEL_ID ist alles abgeschaltet (kein Banner, kein fremder Code).
 * Die Wahl liegt nur im Browser des Besuchers (localStorage).
 */
/** Mehrere Google-Ads-Konten möglich (kommagetrennt, z. B. "AW-1,AW-2") – jedes Konto sieht dann die Conversions. */
const GOOGLE_ADS_IDS = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const GOOGLE_ADS_ID = GOOGLE_ADS_IDS[0] ?? "";
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
/** Irgendein Werbe-Tracking eingerichtet → Cookie-Banner nötig. */
export const TRACKING_ENABLED = Boolean(GOOGLE_ADS_ID || META_PIXEL_ID);

const LABELS = {
  /** Registrierung abgeschlossen (erste Seite des Fragebogens) */
  signup: process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL ?? "",
  /** Testphase gestartet (Zahlungsmethode hinterlegt) */
  trial: process.env.NEXT_PUBLIC_GOOGLE_ADS_TRIAL_LABEL ?? "",
};
/** Standard-Ereignisse des Meta-Pixels für dieselben Conversions. */
const META_EVENTS = { signup: "CompleteRegistration", trial: "StartTrial" };
export type ConversionKind = keyof typeof LABELS;

const CONSENT_KEY = "ff_consent_v1";
export const CONSENT_EVENT = "ff-consent-change";
export const OPEN_CONSENT_EVENT = "ff-consent-open";

export type ConsentChoice = "granted" | "denied" | null;

export function readConsent(): ConsentChoice {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: "granted" | "denied") {
  const before = readConsent();
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Speichern nicht möglich (z. B. privater Modus) – die Wahl gilt dann nur für diese Seite.
  }
  if (choice === "granted") loadTrackingTags();
  // Widerruf: Werbe-Cookies löschen und neu laden, damit kein fremder Code mehr aktiv ist.
  if (choice === "denied" && before === "granted") {
    for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
      if (/^(_gcl|_ga|_gid|_fbp|_fbc)/.test(name)) document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, "")}`;
    }
    location.reload();
    return;
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; callMethod?: (...args: unknown[]) => void };
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const addScript = (src: string) => {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
};

let loaded = false;
/** Lädt Google-Tag und Meta-Pixel – nur aufrufen, wenn eingewilligt wurde. */
export function loadTrackingTags() {
  if (loaded || !TRACKING_ENABLED || typeof window === "undefined") return;
  loaded = true;
  if (GOOGLE_ADS_ID) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag erwartet das arguments-Objekt, kein Array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied", analytics_storage: "denied" });
    window.gtag("js", new Date());
    for (const id of GOOGLE_ADS_IDS) window.gtag("config", id);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_ID)}`);
  }
  if (META_PIXEL_ID) {
    // Warteschlange wie im offiziellen Pixel-Code: Aufrufe vor dem Laden des Skripts werden nachgeholt.
    const fbq: Fbq = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = window._fbq = fbq;
    fbq("init", META_PIXEL_ID);
    addScript("https://connect.facebook.net/en_US/fbevents.js");
  }
}

/** Seitenaufruf an Meta melden (bei jedem Seitenwechsel) – nur mit Einwilligung. */
export function trackPageView() {
  if (!META_PIXEL_ID || readConsent() !== "granted") return;
  loadTrackingTags();
  window.fbq?.("track", "PageView");
}

/** Meldet eine Conversion an Google Ads und Meta – höchstens einmal pro Browser und Art, und nur mit Einwilligung. */
export function trackConversion(kind: ConversionKind) {
  const label = LABELS[kind];
  const google = Boolean(GOOGLE_ADS_ID && label);
  if ((!google && !META_PIXEL_ID) || readConsent() !== "granted") return false;
  const doneKey = `ff_conv_${kind}`;
  try {
    if (window.localStorage.getItem(doneKey)) return true;
    window.localStorage.setItem(doneKey, new Date().toISOString());
  } catch {
    // ohne Speicher trotzdem senden
  }
  loadTrackingTags();
  // Label darf das Konto mitbringen ("AW-123/abc") – sonst gilt das erste Konto.
  if (google) window.gtag?.("event", "conversion", { send_to: label.includes("/") ? label : `${GOOGLE_ADS_ID}/${label}` });
  if (META_PIXEL_ID) window.fbq?.("track", META_EVENTS[kind]);
  return true;
}
