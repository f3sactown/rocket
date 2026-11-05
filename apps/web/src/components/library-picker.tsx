"use client";

import { useEffect, useMemo, useState } from "react";
import { entryText, loadLibrary, type LibraryEntry } from "@/lib/library";
import { useLoad } from "@/lib/use-region";
import { BookIcon, CloseIcon } from "./icons";

type Kind = "all" | "exercise" | "routine";

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "exercise", label: "Exercises" },
  { value: "routine", label: "Routines" },
];

/** How many results show before "Show more". */
const PAGE = 40;

/** A "Library" button that opens the exercise and routine library. */
export function LibraryButton({
  onAdd,
  tags,
  className = "",
}: {
  /** Adds the chosen text (a name, or a name and description). */
  onAdd: (text: string) => void;
  /** Tags to start filtered by, e.g. Warm-Up on the Warm-o-rama page. */
  tags?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`link inline-flex items-center gap-1.5 py-1 text-sm ${className}`}
      >
        <span className="text-accent">
          <BookIcon />
        </span>
        Library
      </button>
      {open && (
        <LibraryPicker
          initialTags={tags}
          onClose={() => setOpen(false)}
          onAdd={(text) => {
            onAdd(text);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * The library of exercises and routines from F3 Nation's Exicon, filterable by search, by
 * exercise or routine, and by tag. Tap an entry to read it and add it.
 */
function LibraryPicker({
  initialTags = [],
  onClose,
  onAdd,
}: {
  initialTags?: string[];
  onClose: () => void;
  onAdd: (text: string) => void;
}) {
  const library = useLoad(loadLibrary, []);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  // Close on Escape, and keep the page behind from scrolling.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const entries = useMemo(() => library.value ?? [], [library.value]);
  // Every tag but "Routine" (that's the Exercises / Routines switch), most used first.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries)
      for (const tag of entry.tags)
        if (tag.toLowerCase() !== "routine")
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [entries]);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
      if (kind === "routine" && !entry.isRoutine) return false;
      if (kind === "exercise" && entry.isRoutine) return false;
      if (!tags.every((tag) => entry.tags.includes(tag))) return false;
      if (!words.length) return true;
      const text = [entry.name, ...entry.aliases, entry.description]
        .join("\n")
        .toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [entries, kind, tags, query]);

  function toggleTag(tag: string) {
    setShown(PAGE);
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Library"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[90vh] w-full max-w-xl flex-col gap-3 rounded-t-3xl border border-line-strong bg-surface-raised p-4 shadow-2xl sm:h-[85vh] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-ink">Library</h2>
            <p className="text-xs text-muted">
              Exercises and routines from the{" "}
              <a
                href="https://codex.f3nation.com/exicon"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                F3 Exicon
              </a>
              , updated weekly.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close the library"
            onClick={onClose}
            className="rounded-full border border-line p-2 text-ink-soft hover:text-ink"
          >
            <CloseIcon />
          </button>
        </header>

        <input
          type="search"
          autoFocus
          aria-label="Search the library"
          placeholder="Search by name or description…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          className="input text-base"
        />
        <div
          role="radiogroup"
          aria-label="Exercises or routines"
          className="grid grid-cols-3 gap-1 rounded-full border border-line bg-panel p-1"
        >
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={kind === option.value}
              onClick={() => {
                setKind(option.value);
                setShown(PAGE);
              }}
              className={`rounded-full px-2 py-1.5 text-sm font-medium transition-colors ${
                kind === option.value
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div
            aria-label="Tags"
            className="-mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-1"
          >
            {/* Chosen tags first, so they're always in view. */}
            {[
              ...allTags.filter((t) => tags.includes(t)),
              ...allTags.filter((t) => !tags.includes(t)),
            ].map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(tag)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                    on
                      ? "border-accent/60 bg-accent-soft text-ink"
                      : "border-line text-ink-soft hover:border-line-strong"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
          {library.error ? (
            <p className="py-8 text-center text-sm text-accent">
              {library.error}
            </p>
          ) : library.loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              The library hasn&apos;t been loaded yet. It fills in after the
              weekly Exicon sync runs.
            </p>
          ) : (
            <>
              <p className="pb-2 text-xs text-muted">
                {results.length} {results.length === 1 ? "match" : "matches"}
                {tags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTags([])}
                    className="ml-2 underline"
                  >
                    Clear tags
                  </button>
                )}
              </p>
              <ul className="flex flex-col divide-y divide-line">
                {results.slice(0, shown).map((entry) => (
                  <Entry
                    key={entry.id}
                    entry={entry}
                    open={open === entry.id}
                    onToggle={() =>
                      setOpen((current) =>
                        current === entry.id ? null : entry.id,
                      )
                    }
                    onAdd={onAdd}
                  />
                ))}
              </ul>
              {results.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="link self-center py-3 text-sm"
                >
                  Show more ({results.length - shown} left)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Entry({
  entry,
  open,
  onToggle,
  onAdd,
}: {
  entry: LibraryEntry;
  open: boolean;
  onToggle: () => void;
  onAdd: (text: string) => void;
}) {
  return (
    <li className="py-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-col items-start gap-0.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-hover"
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium text-ink">{entry.name}</span>
          {entry.isRoutine && (
            <span className="shrink-0 text-xs text-accent">Routine</span>
          )}
        </span>
        {entry.aliases.length > 0 && (
          <span className="text-xs text-muted">
            Also: {entry.aliases.join(", ")}
          </span>
        )}
        <span className="text-xs text-muted">
          {entry.tags.filter((t) => t.toLowerCase() !== "routine").join(" · ")}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-2 pb-3">
          {entry.description && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
              {entry.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAdd(entryText(entry, false))}
              className="btn px-4 py-1.5 text-sm"
            >
              Add
            </button>
            {entry.description && (
              <button
                type="button"
                onClick={() => onAdd(entryText(entry, true))}
                className="btn px-4 py-1.5 text-sm"
              >
                Add with description
              </button>
            )}
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="link ml-auto text-xs"
            >
              F3 Codex ↗
            </a>
            {entry.videoUrl && (
              <a
                href={entry.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="link text-xs"
              >
                Video ↗
              </a>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
