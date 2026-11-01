"use client";

import { useEffect } from "react";
import { rocketIconSvg } from "@/lib/rocket-icon";
import { ACCENTS } from "@/lib/theme";

/** Redraws the browser-tab icon in the current accent color whenever it changes. */
export function FaviconSync() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const accent =
        ACCENTS.find((a) => a.value === root.dataset.accent) ?? ACCENTS[0];
      const href = `data:image/svg+xml,${encodeURIComponent(rocketIconSvg(accent.rocket))}`;
      document
        .querySelectorAll<HTMLLinkElement>('link[rel="icon"]')
        .forEach((link) => {
          link.href = href;
        });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-accent"],
    });
    return () => observer.disconnect();
  }, []);
  return null;
}
