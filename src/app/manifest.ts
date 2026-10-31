import type { MetadataRoute } from "next";

/** Web-App-Manifest: FallFlow lässt sich auf dem Handy zum Home-Bildschirm hinzufügen (auf dem iPhone Voraussetzung für Benachrichtigungen). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FallFlow",
    short_name: "FallFlow",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
