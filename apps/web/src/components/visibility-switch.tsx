"use client";

export type Visibility = "public" | "private";

/** Public (anyone signed in can see it) or private (only you), as a two-way switch. */
export function VisibilitySwitch({
  value,
  onChange,
  label = "Who can see this workout",
  publicHint = "Anyone signed in can see, like and reuse it",
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  label?: string;
  publicHint?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-1 rounded-full border border-line bg-panel p-1 text-xs"
    >
      {(["public", "private"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          title={option === "public" ? publicHint : "Only you can see it"}
          onClick={() => value !== option && onChange(option)}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            value === option
              ? "bg-surface-raised text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          {option === "public" ? "Public" : "Private"}
        </button>
      ))}
    </div>
  );
}
