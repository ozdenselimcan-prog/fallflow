/** Empfehlungscode: 3–30 Zeichen, Kleinbuchstaben, Ziffern und Bindestriche (nicht am Anfang/Ende). Büros können ihn selbst wählen. */
export const REFERRAL_CODE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

/** Cookie, das den Empfehlungscode nach dem Öffnen des Empfehlungslinks 30 Tage merkt (Registrierung später ohne Link). */
export const REFERRAL_COOKIE = "ff_ref";
export const REFERRAL_COOKIE_DAYS = 30;
