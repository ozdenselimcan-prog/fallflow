import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Alle Seiten außer dem einbettbaren Widget dürfen nicht geframed werden.
        source: "/((?!widget/).*)",
        headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // Das Chat-Widget wird per iframe auf Kunden-Websites eingebunden.
        source: "/widget/:path*",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

// Lädt Quellcode-Zuordnungen zu Sentry hoch, damit Stacktraces lesbar sind – nur mit SENTRY_AUTH_TOKEN aktiv,
// sonst baut Next.js ganz normal ohne Sentry-Schritt.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
