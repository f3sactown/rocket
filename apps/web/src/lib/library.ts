import { createClient } from "./supabase/client";

/** Where a Library entry comes from: F3 Nation's Exicon, FiA's, or a region's own sheet. */
export type LibrarySource = "f3" | "fia" | "region";

/** One exercise or routine in the Library (a weekly copy of the F3 and FiA Exicons). */
export interface LibraryEntry {
  id: string;
  source: LibrarySource;
  /** For a region's own entry, the region's name (its badge). */
  regionName: string | null;
  name: string;
  description: string;
  aliases: string[];
  tags: string[];
  isRoutine: boolean;
  videoUrl: string | null;
  /** The entry's page (the F3 Codex, FiA's sheet, or the region's sheet). */
  url: string;
}

const PAGE = 1000;
let cache: Promise<LibraryEntry[]> | null = null;

/** The whole Library, by name. Loaded once per visit; it only changes weekly. */
export function loadLibrary(): Promise<LibraryEntry[]> {
  cache ??= (async () => {
    const supabase = createClient();
    const entries: LibraryEntry[] = [];
    // Page through (the database returns at most 1000 rows at a time), with a cap in case a page
    // never comes back short.
    for (let from = 0; from < PAGE * 20; from += PAGE) {
      const { data, error } = await supabase
        .from("exicon_entries")
        .select(
          "id, source, name, description, aliases, tags, is_routine, video_url, url, region:regions(name)",
        )
        .order("name")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      entries.push(
        ...(data ?? []).map((row) => ({
          id: row.id,
          source: row.source,
          regionName:
            (row as { region?: { name: string } | null }).region?.name ?? null,
          name: row.name,
          description: row.description,
          aliases: row.aliases ?? [],
          tags: row.tags ?? [],
          isRoutine: row.is_routine,
          videoUrl: row.video_url,
          url: row.url,
        })),
      );
      if (!data || data.length < PAGE) break;
    }
    return entries;
  })().catch((error) => {
    cache = null;
    throw error;
  });
  return cache;
}

/** Text to add for an entry: its name, or its name and description. */
export function entryText(entry: LibraryEntry, withDescription: boolean) {
  return withDescription && entry.description.trim()
    ? `${entry.name}\n${entry.description.trim()}`
    : entry.name;
}
