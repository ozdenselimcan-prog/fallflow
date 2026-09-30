import * as Sentry from "@sentry/nextjs";

// Ohne NEXT_PUBLIC_SENTRY_DSN bleibt Fehler-Monitoring im Browser aus – kein Absturz, kein Pflicht-Setup.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  });
}
