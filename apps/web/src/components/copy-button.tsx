"use client";

import { useState } from "react";
import { CopyIcon } from "./icons";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn w-full"
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
