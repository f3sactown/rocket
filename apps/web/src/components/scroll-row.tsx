"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How far a mouse moves before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 5;

/**
 * A list that scrolls sideways. Phones and trackpads swipe it; with a mouse, arrow buttons at
 * either end page through it and it can be dragged, since its scrollbar is hidden.
 */
export function ScrollRow({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const row = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });
  const drag = useRef<{
    x: number;
    left: number;
    moved: boolean;
  } | null>(null);

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEnds({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  function page(direction: 1 | -1) {
    const el = row.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  function onPointerDown(event: React.PointerEvent<HTMLUListElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag.current = {
      x: event.clientX,
      left: event.currentTarget.scrollLeft,
      moved: false,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLUListElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const el = event.currentTarget;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      d.moved = true;
      // Snapping fights a drag, so it waits until the drag ends.
      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = d.left - dx;
  }

  function endDrag(event: React.PointerEvent<HTMLUListElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    const el = event.currentTarget;
    const left = el.scrollLeft;
    el.style.scrollSnapType = "";
    el.style.cursor = "";
    // Settle on the nearest tile from where the drag left off.
    el.scrollLeft = left;
    // The drag ends in a click on the tile under the mouse; don't follow it.
    el.addEventListener(
      "click",
      (click) => {
        click.preventDefault();
        click.stopPropagation();
      },
      { capture: true, once: true },
    );
  }

  const arrow =
    "absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-surface-raised text-ink shadow-lg transition hover:border-accent/60 pointer-fine:flex";

  return (
    <div className="relative">
      <ul
        ref={row}
        className={className}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(event) => event.preventDefault()}
      >
        {children}
      </ul>
      {!ends.start && (
        <button
          type="button"
          aria-label="Scroll back"
          onClick={() => page(-1)}
          className={`${arrow} left-0 -translate-x-1/2`}
        >
          <Chevron flip />
        </button>
      )}
      {!ends.end && (
        <button
          type="button"
          aria-label="Scroll forward"
          onClick={() => page(1)}
          className={`${arrow} right-0 translate-x-1/2`}
        >
          <Chevron />
        </button>
      )}
    </div>
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 ${flip ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
