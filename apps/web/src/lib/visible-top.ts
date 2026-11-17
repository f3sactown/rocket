"use client";

import { useEffect, useState } from "react";

/**
 * How far the part of the page you can see is below the top of the screen's layout. On a phone,
 * the keyboard doesn't shrink the page: the browser scrolls what's visible instead, and something
 * fixed to the top can end up above it, out of sight. Adding this keeps it at the top of what's
 * visible. 0 when nothing's moved (and on the server).
 */
export function useVisibleTop(): number {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setTop(Math.max(0, Math.round(view.offsetTop))),
      );
    };
    update();
    view.addEventListener("resize", update);
    view.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      view.removeEventListener("resize", update);
      view.removeEventListener("scroll", update);
    };
  }, []);
  return top;
}
