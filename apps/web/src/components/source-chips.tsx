"use client";

/** One chip: a key to remember it by, its label and its color. */
export interface SourceChip {
  key: string;
  label: string;
  color: string;
}

/**
 * A "From" row of colored chips to choose which sources to show (Library, PAX, Discover). All are
 * on to start; `off` lists the ones turned off, and at least one always stays on. On a phone it's
 * one line that scrolls sideways; on a wider screen the chips wrap.
 */
export function SourceChips({
  chips,
  off,
  onChange,
  label = "From",
}: {
  chips: SourceChip[];
  off: string[];
  onChange: (off: string[]) => void;
  label?: string;
}) {
  function toggle(key: string) {
    if (off.includes(key)) return onChange(off.filter((k) => k !== key));
    // At least one chip stays on.
    if (chips.filter((c) => !off.includes(c.key)).length > 1)
      onChange([...off, key]);
  }
  return (
    <div
      aria-label="Sources"
      className="scroll-row -mx-4 flex shrink-0 items-center gap-2 overflow-x-auto px-4 pb-1 text-xs text-ink-soft sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
    >
      <span className="shrink-0">{label}</span>
      {chips.map((chip) => {
        const on = !off.includes(chip.key);
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(chip.key)}
            className={`shrink-0 rounded-full border px-3 py-1 font-bold whitespace-nowrap transition-colors ${
              on ? "" : "border-line text-muted"
            }`}
            style={
              on
                ? {
                    background: chip.color,
                    borderColor: chip.color,
                    color: "var(--badge-text)",
                  }
                : undefined
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
