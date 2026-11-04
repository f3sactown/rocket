"use client";

import { attendeeLabel, formatDate } from "@rocket/core";
import { useEffect, useMemo, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastList } from "@/components/backblast-list";
import { parseAttendees } from "@/lib/backblast";
import {
  asItems,
  listColumns,
  tableFor,
  type ItemKind,
  loadArchivedIds,
  type ListItem,
} from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";

export default function SearchPage() {
  return <SignedIn>{(user) => <Search user={user} />}</SignedIn>;
}

/** Every searchable field, besides the title, of each kind. */
const BACKBLAST_COLUMNS = [
  "ao",
  "q",
  "address",
  "time",
  "introduction",
  "warmup",
  "thang",
  "notes",
  "announcements",
  "words_of_wisdom",
  "third_f",
  "second_f",
] as const;

const WORKOUT_COLUMNS = [
  "ao",
  "address",
  "time",
  "introduction",
  "warmup",
  "thang",
  "announcements",
  "words_of_wisdom",
] as const;

interface Searchable {
  item: ListItem;
  /** Everything else that can match, one piece per field. */
  fields: string[];
}

/** Loads what can be searched of a kind: the finished ones and your own drafts. */
async function loadSearchable(kind: ItemKind): Promise<Searchable[]> {
  const columns: readonly string[] =
    kind === "workout" ? WORKOUT_COLUMNS : BACKBLAST_COLUMNS;
  const { data, error } = await createClient()
    .from(tableFor(kind))
    .select(
      `${listColumns(kind)}, ${kind === "backblast" ? "attendees, " : ""}${columns.join(", ")}`,
    )
    .order("date", { ascending: false, nullsFirst: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (asItems(kind, data) as (ListItem & Record<string, unknown>)[]).map(
    (row) => ({
      item: row,
      fields: [
        ...columns.map((column) => row[column]),
        row.date && formatDate(row.date),
        row.author?.name,
        ...parseAttendees(row.attendees).map(attendeeLabel),
      ].filter(
        (value): value is string => typeof value === "string" && !!value,
      ),
    }),
  );
}

/** About this much text either side of a match, for the line under a result. */
const SNIPPET_CHARS = 40;

/** A short excerpt around the first word found outside the title, if any. */
function snippet(entry: Searchable, words: string[]): string | undefined {
  const title = entry.item.title.toLowerCase();
  const word = words.find((w) => !title.includes(w));
  if (!word) return undefined;
  for (const field of entry.fields) {
    const at = field.toLowerCase().indexOf(word);
    if (at < 0) continue;
    const from = Math.max(0, at - SNIPPET_CHARS);
    const to = Math.min(field.length, at + word.length + SNIPPET_CHARS);
    return `${from > 0 ? "…" : ""}${field.slice(from, to).replace(/\s+/g, " ").trim()}${to < field.length ? "…" : ""}`;
  }
}

/**
 * Searches everything the user can see. Backblasts are the only kind so far; results are grouped
 * by kind so more can be added. Every word must appear somewhere in a result.
 */
function Search({ user }: { user: CurrentUser }) {
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [data, setData] = useState<{
    entries: Searchable[];
    archived: Set<string>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadSearchable("workout"),
      loadSearchable("backblast"),
      loadArchivedIds("workout"),
      loadArchivedIds("backblast"),
    ]).then(
      ([workouts, backblasts, archivedWorkouts, archivedBackblasts]) =>
        setData({
          entries: [...workouts, ...backblasts],
          archived: new Set([...archivedWorkouts, ...archivedBackblasts]),
        }),
      (e: Error) => setError(e.message),
    );
  }, [user.id]);

  const words = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );

  const results = useMemo(() => {
    if (!data || words.length === 0) return [];
    return data.entries.filter((entry) => {
      if (!includeArchived && data.archived.has(entry.item.id)) return false;
      const text = [entry.item.title, ...entry.fields].join("\n").toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [data, words, includeArchived]);

  return (
    <section className="card">
      <h1 className="card-title">Search</h1>
      <div className="flex flex-col gap-3">
        <input
          type="search"
          autoFocus
          aria-label="Search"
          placeholder="Search workouts, backblasts, AOs, PAX…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input text-base"
        />
        <label className="flex items-center gap-2 self-start text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Include archived
        </label>
      </div>

      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">{error}</p>
      ) : !data ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : words.length === 0 ? null : (
        <BackblastList
          // A new search starts a fresh list, so rows swiped away earlier come back if they match.
          key={`${words.join(" ")}|${includeArchived}`}
          user={user}
          archived={(item) => data.archived.has(item.id)}
          onArchived={(id, archived) =>
            setData((current) => {
              if (!current) return current;
              const next = new Set(current.archived);
              if (archived) next.add(id);
              else next.delete(id);
              return { ...current, archived: next };
            })
          }
          onDeleted={(id) =>
            setData(
              (current) =>
                current && {
                  ...current,
                  entries: current.entries.filter((e) => e.item.id !== id),
                },
            )
          }
          highlight={words}
          snippets={Object.fromEntries(
            results.flatMap((entry) => {
              const text = snippet(entry, words);
              return text ? [[entry.item.id, text]] : [];
            }),
          )}
          groups={(["workout", "backblast"] as const).map((kind) => {
            const items = results
              .map((entry) => entry.item)
              .filter((item) => item.kind === kind);
            return {
              title: `${kind === "workout" ? "Workouts" : "Backblasts"} · ${items.length}`,
              items,
              empty: "No matches.",
            };
          })}
        />
      )}
    </section>
  );
}
