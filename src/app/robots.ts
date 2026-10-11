import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

/** Suchmaschinen: öffentliche Seiten ja, App-Bereiche (Dashboard, APIs, Upload-Links, Widget) nein. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/onboarding", "/admin", "/api/", "/upload/", "/widget/"] },
    sitemap: `${siteConfig.appUrl}/sitemap.xml`,
  };
}
