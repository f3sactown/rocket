"use client";

import { useEffect, useState } from "react";
import { LinkIcon } from "./icons";

/**
 * "Share link" in a page's row of small actions: the link to this workout or backblast, through
 * the device's share sheet (so Band, Slack and Messages show it as a link), or copied where
 * sharing isn't available. A draft or private one can't be opened by anyone else, so instead of
 * sharing it says why, in place of its label for a moment.
 */
export function ShareLinkButton({
  path,
  blocked,
}: {
  /** The page's path, e.g. "/workout/?id=…". */
  path: string;
  /** Why the link can't be shared yet, or nothing when it can. */
  blocked?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(timer);
  }, [note]);

  async function share() {
    if (blocked) return setNote(blocked);
    const url = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setNote("Couldn't share");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch {
      setNote("Couldn't copy the link");
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-disabled={!!blocked}
      title={blocked}
      className={`link inline-flex items-center gap-1.5 hover:text-ink ${blocked ? "opacity-50" : ""}`}
    >
      <LinkIcon />
      <span aria-live="polite">{note ?? "Share link"}</span>
    </button>
  );
}
