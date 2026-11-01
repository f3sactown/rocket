import type { MetadataRoute } from "next";

// Built into the static site at build time.
export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Web app manifest: lets phones install Rocket as an app that opens full screen ("standalone"),
 * without the browser's address bar, with its own icon and colors.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "Rocket",
    short_name: "Rocket",
    description: "Tools for F3 PAX, starting with backblasts.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    // Matches the launch animation, so opening the app goes straight into it.
    background_color: "#05070b",
    theme_color: "#070a10",
    icons: [
      {
        src: `${base}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
