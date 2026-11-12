import type { Metadata } from "next";

/** The site's own origin, for link previews, which need full URLs. */
const ORIGIN = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://rocket.f3sactown.com",
).origin;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ICON = `${ORIGIN}${BASE}/icons/icon-512.png`;

export const DESCRIPTION = "Plan workouts and write backblasts for F3 and FiA.";

/**
 * What a link shows when it's texted or posted in a chat: Rocket's icon, a title and a
 * description. Next replaces (not merges) `openGraph` from a parent layout, so each page that
 * sets its own title takes the whole set.
 */
export function shareMetadata(title: string): Metadata {
  return {
    metadataBase: new URL(`${ORIGIN}${BASE}/`),
    openGraph: {
      type: "website",
      siteName: "Rocket",
      title,
      description: DESCRIPTION,
      images: [{ url: ICON, width: 512, height: 512, alt: "Rocket" }],
    },
    twitter: {
      card: "summary",
      title,
      description: DESCRIPTION,
      images: [ICON],
    },
  };
}
