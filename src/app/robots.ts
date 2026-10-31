import type { MetadataRoute } from "next";
import { indexable, siteConfig } from "@/lib/config/site";

/** Suchmaschinen: öffentliche Seiten ja, App-Bereiche (Dashboard, APIs, Upload-Links, Widget) nein. */
export default function robots(): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/onboarding", "/admin", "/api/", "/upload/", "/termin/", "/widget/"] },
    sitemap: `${siteConfig.appUrl}/sitemap.xml`,
  };
}
