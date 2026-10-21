import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

/** Öffentliche Seiten für Google & Co. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/demo", priority: 0.8, changeFrequency: "monthly" },
    { path: "/funktionen", priority: 0.8, changeFrequency: "monthly" },
    { path: "/so-funktioniert-es", priority: 0.8, changeFrequency: "monthly" },
    { path: "/preise", priority: 0.8, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/signup", priority: 0.7, changeFrequency: "monthly" },
    { path: "/agb", priority: 0.2, changeFrequency: "yearly" },
    { path: "/avv", priority: 0.2, changeFrequency: "yearly" },
    { path: "/datenschutz", priority: 0.2, changeFrequency: "yearly" },
    { path: "/impressum", priority: 0.2, changeFrequency: "yearly" },
  ];
  return pages.map((p) => ({ url: `${siteConfig.appUrl}${p.path}`, lastModified: new Date(), changeFrequency: p.changeFrequency, priority: p.priority }));
}
