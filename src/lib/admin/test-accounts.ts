/**
 * Automatisch erzeugte Testkonten (claude-…, ff…/fd… + Zeitstempel @mailinator.com) – echte Kundenkonten fasst das nie an.
 * Das Konto für die Demo-Videos (ffvideo…) bleibt bestehen.
 */
export const isTestAccount = (email: string) =>
  /^(claude-[^@]+|f[fd](?!video)[a-z]*\d{12,})@mailinator\.com$/i.test(email);
