"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";

/**
 * Opens the device's share sheet (Messages, Band, Slack, email…) with the text. Where sharing isn't
 * available, e.g. most desktop browsers, it copies the text instead. Without a title, only the
 * text is shared, so apps get exactly what Copy gives (some put a title in front of the text).
 */
export function ShareButton({
  title,
  text,
  className = "btn w-full px-4",
  disabled = false,
}: {
  title?: string;
  text: string;
  className?: string;
  /** While the text is still being put together. */
  disabled?: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    setMessage(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(title ? { title, text } : { text });
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
      <button
        type="button"
        onClick={share}
        disabled={disabled}
        className={`${className} disabled:opacity-50`}
      >
        <ShareIcon />
        Share
      </button>
      {message && <p className="text-center text-xs text-muted">{message}</p>}
    </div>
  );
}
