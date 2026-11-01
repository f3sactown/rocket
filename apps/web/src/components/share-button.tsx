"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";

/**
 * Opens the device's share sheet (Messages, Slack, email…) with the text. Where sharing isn't
 * available, e.g. most desktop browsers, it copies the text instead.
 */
export function ShareButton({
  title,
  text,
  className = "btn w-full px-4",
}: {
  title: string;
  text: string;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    setMessage(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text });
      } catch (error) {
        // Closing the share sheet isn't an error worth showing.
        if ((error as Error).name !== "AbortError")
          setMessage("Couldn't share. Try Copy instead.");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Sharing isn't available here, so it was copied instead.");
    } catch {
      setMessage("Couldn't share or copy on this device.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={share} className={className}>
        <ShareIcon />
        Share
      </button>
      {message && <p className="text-center text-xs text-muted">{message}</p>}
    </div>
  );
}
