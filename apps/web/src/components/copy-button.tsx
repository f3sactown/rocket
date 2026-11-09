"use client";

import { useState } from "react";
import { CopyIcon } from "./icons";

export function CopyButton({
  text,
  disabled = false,
}: {
  text: string;
  /** While the text is still being put together. */
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn w-full px-4 disabled:opacity-50"
      disabled={disabled}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      <CopyIcon />
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
