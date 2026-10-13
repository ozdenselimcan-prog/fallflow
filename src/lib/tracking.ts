"use client";

/**
 * Google-Ads-Conversion-Tracking – nur nach ausdrücklicher Einwilligung (§ 25 TDDDG). Ohne NEXT_PUBLIC_GOOGLE_ADS_ID
 * ist alles abgeschaltet (kein Banner, kein Google-Code). Die Wahl liegt nur im Browser des Besuchers (localStorage).
 */
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";
const LABELS = {
  /** Registrierung abgeschlossen (erste Seite des Fragebogens) */
  signup: process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL ?? "",
  /** Testphase gestartet (Zahlungsmethode hinterlegt) */
  trial: process.env.NEXT_PUBLIC_GOOGLE_ADS_TRIAL_LABEL ?? "",
};
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
  if (choice === "granted") loadGoogleTag();
  // Widerruf: Google-Cookies löschen und neu laden, damit kein Google-Code mehr aktiv ist.
  if (choice === "denied" && before === "granted") {
    for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
      if (/^(_gcl|_ga|_gid)/.test(name)) document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, "")}`;
    }
    location.reload();
    return;
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let loaded = false;
/** Lädt den Google-Tag – nur aufrufen, wenn eingewilligt wurde. */
export function loadGoogleTag() {
  if (loaded || !GOOGLE_ADS_ID || typeof window === "undefined") return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag erwartet das arguments-Objekt, kein Array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied", analytics_storage: "denied" });
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_ID)}`;
  document.head.appendChild(s);
}

/** Meldet eine Conversion an Google Ads – höchstens einmal pro Browser und Art, und nur mit Einwilligung. */
export function trackConversion(kind: ConversionKind) {
  const label = LABELS[kind];
  if (!GOOGLE_ADS_ID || !label || readConsent() !== "granted") return false;
  const doneKey = `ff_conv_${kind}`;
  try {
    if (window.localStorage.getItem(doneKey)) return true;
    window.localStorage.setItem(doneKey, new Date().toISOString());
  } catch {
    // ohne Speicher trotzdem senden
  }
  loadGoogleTag();
  window.gtag?.("event", "conversion", { send_to: `${GOOGLE_ADS_ID}/${label}` });
  return true;
}
