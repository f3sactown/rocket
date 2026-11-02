"use client";

import { useRef, useState } from "react";

export interface SwipeOption {
  label: string;
  /** Background color behind the row while swiping. */
  color: string;
  onCommit: () => void;
}

/** How far (in pixels, or a share of the row's width if smaller) a swipe must go to count. */
const THRESHOLD_PX = 110;
const THRESHOLD_SHARE = 0.4;

/**
 * A list row that can be swiped left or right to act on it, like Mail. A short swipe springs
 * back; a long one slides the row away and runs the action. Vertical scrolling is untouched.
 */
export function SwipeRow({
  left,
  right,
  children,
}: {
  /** What swiping left does (revealed on the right). */
  left?: SwipeOption;
  /** What swiping right does (revealed on the left). */
  right?: SwipeOption;
  children: React.ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const mode = useRef<"idle" | "pending" | "dragging" | "scrolling">("idle");
  const moved = useRef(false);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);

  const width = () => row.current?.offsetWidth ?? 320;
  const threshold = () => Math.min(THRESHOLD_PX, width() * THRESHOLD_SHARE);

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    mode.current = "pending";
    moved.current = false;
    setAnimating(false);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!start.current || event.pointerId !== start.current.id) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (mode.current === "pending") {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        mode.current = "scrolling";
        return;
      }
      if (Math.abs(dx) > 8) {
        mode.current = "dragging";
        moved.current = true;
        row.current?.setPointerCapture(event.pointerId);
      }
    }
    if (mode.current !== "dragging") return;
    // Only the directions with an action move; past the threshold the row moves more slowly.
    let next = dx;
    if ((next < 0 && !left) || (next > 0 && !right)) next = 0;
    const limit = threshold();
    if (Math.abs(next) > limit)
      next = Math.sign(next) * (limit + (Math.abs(next) - limit) * 0.6);
    setOffset(next);
  }

  function onPointerEnd() {
    const dragging = mode.current === "dragging";
    start.current = null;
    mode.current = "idle";
    if (!dragging) return;
    setAnimating(true);
    const action = offset < 0 ? left : right;
    if (action && Math.abs(offset) >= threshold()) {
      setOffset(Math.sign(offset) * width());
      setTimeout(action.onCommit, 180);
    } else {
      setOffset(0);
    }
  }

  const shown = offset < 0 ? left : offset > 0 ? right : undefined;
  const past = Math.abs(offset) >= threshold();

  return (
    <div className="relative overflow-hidden rounded-xl">
      {shown && (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center px-5 text-sm font-semibold text-white ${
            offset < 0 ? "justify-end" : "justify-start"
          }`}
          style={{ background: shown.color, opacity: past ? 1 : 0.75 }}
        >
          {shown.label}
        </div>
      )}
      <div
        ref={row}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        // A swipe isn't a tap: don't open the backblast after one.
        onClickCapture={(event) => {
          if (moved.current) {
            event.preventDefault();
            event.stopPropagation();
            moved.current = false;
          }
        }}
        onDragStart={(event) => event.preventDefault()}
        className="relative bg-panel select-none"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? "transform 180ms ease-out" : undefined,
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
