"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteMyExercise,
  entryText,
  loadLibrary,
  loadMyExercises,
  saveMyExercise,
  type LibraryEntry,
  type LibrarySource,
  type MyExercise,
} from "@/lib/library";
import { loadRegions } from "@/lib/regions";
import { useLoad } from "@/lib/use-region";
import { BookIcon, CloseIcon } from "./icons";

type Kind = "all" | "exercise" | "routine";

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "exercise", label: "Exercises" },
  { value: "routine", label: "Routines" },
];

/**
 * The sources, each badged in its organization's color, or (when that color is the accent) F3
 * orange and FiA blue (see --badge-* in globals.css, which follow the accent as it changes).
 * Each configured region is a source of its own too, in a neutral color.
 */
const SOURCES: { value: LibrarySource; label: string; color: string }[] = [
  {
    value: "f3",
    label: "F3",
    color: "var(--badge-f3)",
  },
  {
    value: "fia",
    label: "FiA",
    color: "var(--badge-fia)",
  },
  {
    value: "region",
    label: "Region",
    color: "var(--badge-region)",
  },
  {
    value: "mine",
    label: "Mine",
    color: "var(--color-accent)",
  },
];

/**
 * A small F3 or FiA badge in that organization's color, the region's name for its own, or an
 * outlined "Mine" in the accent color for the user's own.
 */
function SourceBadge({ entry }: { entry: LibraryEntry }) {
  const source = SOURCES.find((s) => s.value === entry.source)!;
  const label = (entry.source === "region" && entry.regionName) || source.label;
  const color = source.color;
  if (entry.source === "mine")
    return (
      <span className="shrink-0 rounded-full border border-accent px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-accent">
        {label}
      </span>
    );
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-black"
      style={{ background: color }}
    >
      {label}
    </span>
  );
}

/** Which chip an entry belongs to: F3, FiA, or its region's ID. */
function sourceKey(entry: LibraryEntry): string {
  return entry.source === "region"
    ? (entry.regionId ?? "region")
    : entry.source;
}

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
 * The library pop-up: the browser below in a sheet, for adding an entry to the section being
 * written.
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
                F3
              </a>{" "}
              and{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/1-aBi3UGOwhGChtKEFdVjikbqfcCWP35mcoKqqxqKssI/edit"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                FiA
              </a>{" "}
              Exicons (updated weekly), plus each region&apos;s own Exicon from
              its sheet (updated daily).
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

        <LibraryBrowser
          initialTags={initialTags}
          onAdd={onAdd}
          scroll
          autoFocus
        />
      </div>
    </div>
  );
}

/**
 * The library of exercises and routines from the F3 and FiA Exicons, filterable by search, by
 * source, by exercise or routine, and by tag. Tap an entry to read it, then add it (with `onAdd`)
 * or copy it.
 */
export function LibraryBrowser({
  initialTags = [],
  onAdd,
  scroll = false,
  autoFocus = false,
}: {
  initialTags?: string[];
  /** Adds the chosen text; without it, entries offer Copy instead. */
  onAdd?: (text: string) => void;
  /** Scroll the results inside a fixed-height box (the pop-up) rather than with the page. */
  scroll?: boolean;
  autoFocus?: boolean;
}) {
  const library = useLoad(loadLibrary, []);
  // Your own exercises, reloaded after you add, change or delete one.
  const [mineVersion, setMineVersion] = useState(0);
  const mine = useLoad(() => loadMyExercises(), [mineVersion]);
  const [adding, setAdding] = useState(false);
  const reloadMine = () => setMineVersion((v) => v + 1);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [tags, setTags] = useState<string[]>(initialTags);
  // Every source is on to start (F3, FiA and each configured region), so this tracks the ones
  // turned off; at least one stays on.
  const [off, setOff] = useState<string[]>([]);
  const regions = useLoad(() => loadRegions(), []);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  // Everything, with your own mixed in by name.
  const entries = useMemo(
    () =>
      [...(library.value ?? []), ...(mine.value ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [library.value, mine.value],
  );
  // The chips: Mine, F3, FiA, then every configured region (whether or not it has entries yet).
  const chips = useMemo(() => {
    const region = SOURCES.find((s) => s.value === "region")!;
    return [
      ...["mine", "f3", "fia"]
        .map((key) => SOURCES.find((s) => s.value === key)!)
        .map((s) => ({
          key: s.value as string,
          label: s.label,
          color: s.color,
        })),
      ...(regions.value ?? []).map((r) => ({
        key: r.id,
        label: r.name,
        color: region.color,
      })),
    ];
  }, [regions.value]);
  // Every tag but "Routine" (that's the Exercises / Routines switch), in alphabetical order.
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const entry of entries)
      for (const tag of entry.tags)
        if (tag.toLowerCase() !== "routine") tags.add(tag);
    return [...tags].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
    );
  }, [entries]);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
      if (off.includes(sourceKey(entry))) return false;
      if (kind === "routine" && !entry.isRoutine) return false;
      if (kind === "exercise" && entry.isRoutine) return false;
      if (!tags.every((tag) => entry.tags.includes(tag))) return false;
      if (!words.length) return true;
      const text = [entry.name, ...entry.aliases, entry.description]
        .join("\n")
        .toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [entries, kind, tags, query, off]);

  function toggleSource(key: string) {
    setShown(PAGE);
    setOff((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : // At least one chip stays on.
          chips.filter((c) => !current.includes(c.key)).length > 1
          ? [...current, key]
          : current,
    );
  }

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
      className={
        scroll ? "flex min-h-0 flex-1 flex-col gap-3" : "flex flex-col gap-3"
      }
    >
      <input
        type="search"
        autoFocus={autoFocus}
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
        aria-label="Sources"
        className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"
      >
        <span>From</span>
        {chips.map((option) => {
          const on = !off.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleSource(option.key)}
              className={`rounded-full border px-3 py-1 font-bold transition-colors ${
                on ? "text-black" : "border-line text-muted"
              }`}
              style={
                on
                  ? { background: option.color, borderColor: option.color }
                  : undefined
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
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
        <div aria-label="Tags" className="flex shrink-0 flex-wrap gap-1.5">
          {/* Every tag in view, wrapping onto more rows; each keeps its place when chosen. */}
          {allTags.map((tag) => {
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

      <div
        className={
          scroll
            ? "-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1"
            : "flex flex-col"
        }
      >
        {adding ? (
          <MyExerciseForm
            onDone={(saved) => {
              setAdding(false);
              if (saved) reloadMine();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="link mb-2 self-start text-sm"
          >
            + Add your own exercise
          </button>
        )}
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
                  onChanged={reloadMine}
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
  );
}

function Entry({
  entry,
  open,
  onToggle,
  onAdd,
  onChanged,
}: {
  entry: LibraryEntry;
  open: boolean;
  onToggle: () => void;
  onAdd?: (text: string) => void;
  /** After one of your own is changed or deleted. */
  onChanged: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (editing)
    return (
      <li className="py-2">
        <MyExerciseForm
          id={entry.id}
          initial={{
            name: entry.name,
            description: entry.description,
            tags: entry.tags,
            isRoutine: entry.isRoutine,
          }}
          onDone={(saved) => {
            setEditing(false);
            if (saved) onChanged();
          }}
        />
      </li>
    );
  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied("Couldn't copy");
    }
  }
  // Add into the form being written, or copy for use anywhere.
  const act = onAdd
    ? (_label: string, text: string) => onAdd(text)
    : (label: string, text: string) => copy(label, text);
  const verb = onAdd ? "Add" : "Copy";
  return (
    <li className="py-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-col items-start gap-0.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-hover"
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="font-medium text-ink">{entry.name}</span>
          <SourceBadge entry={entry} />
        </span>
        {entry.aliases.length > 0 && (
          <span className="text-xs text-muted">
            Also: {entry.aliases.join(", ")}
          </span>
        )}
        {entry.tags.length > 0 && (
          <span className="text-xs text-muted">{entry.tags.join(" · ")}</span>
        )}
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
              onClick={() => act("name", entryText(entry, false))}
              className="btn px-4 py-1.5 text-sm"
            >
              {copied === "name" ? "Copied" : verb}
            </button>
            {entry.description && (
              <button
                type="button"
                onClick={() => act("full", entryText(entry, true))}
                className="btn px-4 py-1.5 text-sm"
              >
                {copied === "full" ? "Copied" : `${verb} with description`}
              </button>
            )}
            {copied === "Couldn't copy" && (
              <span className="text-xs text-accent">Couldn&apos;t copy</span>
            )}
            {entry.source === "mine" && (
              <span className="ml-auto flex items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="link"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete "${entry.name}" from your library?`))
                      return;
                    try {
                      await deleteMyExercise(entry.id);
                      onChanged();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                  className="link"
                >
                  Delete
                </button>
              </span>
            )}
            {error && <span className="text-xs text-accent">{error}</span>}
            {entry.url && (
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="link ml-auto text-xs"
              >
                {entry.source === "region"
                  ? `${entry.regionName ?? "Region"} sheet ↗`
                  : entry.source === "fia"
                    ? "FiA Exicon ↗"
                    : "F3 Codex ↗"}
              </a>
            )}
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

/** Adds one of your own exercises, or changes one (with `id`). Only you can see them. */
function MyExerciseForm({
  id,
  initial,
  onDone,
}: {
  id?: string;
  initial?: MyExercise;
  /** Called after saving (true) or cancelling (false). */
  onDone: (saved: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [isRoutine, setIsRoutine] = useState(initial?.isRoutine ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Give it a name.");
    setSaving(true);
    setError(null);
    try {
      await saveMyExercise(
        { name, description, tags: tags.split(","), isRoutine },
        id,
      );
      onDone(true);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    // The pop-up sits inside the workout form, so Enter saves this instead of submitting that.
    <div
      className="mb-3 flex flex-col gap-3 rounded-xl border border-accent/40 p-3"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          save();
        }
      }}
    >
      <p className="text-xs text-muted">
        {id ? "Edit your exercise." : "Add your own exercise or routine."} Only
        you can see it; it&apos;s part of your exported data.
      </p>
      <input
        aria-label="Name"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input"
      />
      <textarea
        aria-label="Description"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="input"
      />
      <input
        aria-label="Tags"
        placeholder="Tags, separated by commas (optional)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="input"
      />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={isRoutine}
          onChange={(e) => setIsRoutine(e.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        It&apos;s a routine
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn px-4 py-1.5 text-sm"
        >
          {saving ? "Saving…" : id ? "Save" : "Add to my library"}
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          disabled={saving}
          className="link text-sm"
        >
          Cancel
        </button>
        {error && <span className="text-sm text-accent">{error}</span>}
      </div>
    </div>
  );
}
