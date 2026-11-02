/**
 * Automatisch erzeugte Testkonten (claude-…, ff…/fd… + Zeitstempel @mailinator.com / @maildrop.cc) – echte Kundenkonten fasst das nie an.
 * Das Konto für die Demo-Videos (ffvideo…) bleibt bestehen.
 */
export const isTestAccount = (email: string) =>
  /^(claude-[^@]+|f[fd](?!video)[a-z0-9]*\d{10,}|fdvideo\d{10,})@(mailinator\.com|maildrop\.cc)$/i.test(email);
