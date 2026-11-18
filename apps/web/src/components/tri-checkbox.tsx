"use client";

import { useEffect, useRef } from "react";

/**
 * A checkbox that can also show "some" (a dash): for one that turns several others on or off,
 * when some are on and some aren't.
 */
export function TriCheckbox({
  checked,
  partial = false,
  onChange,
  label,
  className = "",
}: {
  checked: boolean;
  partial?: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = partial;
  }, [partial]);
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap select-none ${className}`}
    >
      <input
        ref={box}
        type="checkbox"
        checked={checked && !partial}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}
