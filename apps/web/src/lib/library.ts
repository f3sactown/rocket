import { createClient } from "./supabase/client";

/**
 * Where a Library entry comes from: F3 Nation's Exicon, FiA's, a region's own sheet, or the
 * user's own (private to them).
 */
export type LibrarySource = "f3" | "fia" | "region" | "mine";

/** One exercise or routine in the Library (a weekly copy of the F3 and FiA Exicons). */
export interface LibraryEntry {
  id: string;
  source: LibrarySource;
  /** For a region's own entry, the region and its name (its badge). */
  regionId: string | null;
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
          "id, source, region_id, name, description, aliases, tags, is_routine, video_url, url, region:regions(name)",
        )
        .order("name")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      entries.push(
        ...(data ?? []).map((row) => ({
          id: row.id,
          source: row.source,
          regionId: row.region_id,
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

/** The user's own exercises and routines, by name. Private to them. */
export async function loadMyExercises(): Promise<LibraryEntry[]> {
  const { data, error } = await createClient()
    .from("user_exercises")
    .select("id, name, description, tags, is_routine")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    source: "mine" as const,
    regionId: null,
    regionName: null,
    name: row.name,
    description: row.description,
    aliases: [],
    tags: row.tags ?? [],
    isRoutine: row.is_routine,
    videoUrl: null,
    url: "",
  }));
}

/** What the user fills in for one of their own exercises. */
export interface MyExercise {
  name: string;
  description: string;
  tags: string[];
  isRoutine: boolean;
}

/** Adds one of the user's own exercises, or saves changes to it (with `id`). */
export async function saveMyExercise(exercise: MyExercise, id?: string) {
  const row = {
    name: exercise.name.trim(),
    description: exercise.description.trim(),
    tags: [...new Set(exercise.tags.map((t) => t.trim()).filter(Boolean))],
    is_routine: exercise.isRoutine,
  };
  const table = createClient().from("user_exercises");
  const { error } = await (id
    ? table.update(row).eq("id", id)
    : table.insert(row));
  if (error) throw new Error(error.message);
}

/** Deletes one of the user's own exercises. */
export async function deleteMyExercise(id: string) {
  const { error } = await createClient()
    .from("user_exercises")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Text to add for an entry: its name, or its name and description. */
export function entryText(entry: LibraryEntry, withDescription: boolean) {
  return withDescription && entry.description.trim()
    ? `${entry.name}\n${entry.description.trim()}`
    : entry.name;
}
