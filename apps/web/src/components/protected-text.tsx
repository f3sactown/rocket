"use client";

import { useEffect, useRef } from "react";

/**
 * Backblast or workout text shown on screen that can't be selected (so it's copied with the Copy
 * or Share button instead). If a copy takes it in anyway, e.g. Select All, it's swapped for
 * `copyText`: exactly what the Copy button gives, with the workout link and the hidden PAX list.
 */
export function ProtectedText({
  children,
  copyText,
  className = "",
}: {
  children: React.ReactNode;
  copyText: string;
  className?: string;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const text = useRef(copyText);
  useEffect(() => {
    text.current = copyText;
  }, [copyText]);

  useEffect(() => {
    // The text can't be selected, so a copy never starts inside it; watch the whole page for a
    // selection that takes it in.
    const onCopy = (event: ClipboardEvent) => {
      const selection = window.getSelection();
      const el = ref.current;
      if (!el || !selection || selection.isCollapsed) return;
      if (!selection.containsNode(el, true)) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", text.current);
    };
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, []);

  return (
    <pre
      ref={ref}
      className={`select-none [-webkit-touch-callout:none] ${className}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </pre>
  );
}
