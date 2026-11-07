import type { MetadataRoute } from "next";

// PWA manifest: lets users "Add to Home Screen" and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poupa.ai — compras mais baratas",
    short_name: "Poupa.ai",
    description: "Compara preços entre supermercados e divide a lista para poupar.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
