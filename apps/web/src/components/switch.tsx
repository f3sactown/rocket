"use client";

/** An on/off switch, e.g. for a notification setting. */
export function Switch({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onToggle(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        on ? "border-accent/60 bg-accent" : "border-line-strong bg-panel"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5.5 rounded-full bg-white shadow transition-[left] ${
          on ? "left-[calc(100%-1.5rem)]" : "left-0.5"
        }`}
      />
    </button>
  );
}
