import { withKeptCopy } from "./kept";
import { createClient } from "./supabase/client";

/** The kinds of things listed, searched and archived. */
export type ItemKind = "workout" | "backblast";

/** A workout or backblast as shown in a list. */
export interface ListItem {
  kind: ItemKind;
  id: string;
  title: string;
  date: string | null;
  ao: string;
  status: "draft" | "published";
  author_id: string;
  author: { name: string } | null;
  /** The author's region, where it's been loaded (Discover). */
  authorRegion?: string | null;
}

const TABLES = {
  workout: {
    table: "workouts",
    archives: "workout_archives",
    key: "workout_id",
  },
  backblast: {
    table: "backblasts",
    archives: "backblast_archives",
    key: "backblast_id",
  },
} as const;

/**
 * The columns for a list row. The author is named by its foreign key, because the archive tables
 * (and backblasts, for workouts) also link these to profiles.
 */
export function listColumns(kind: ItemKind): string {
  return `id, title, date, ao, status, author_id, author:profiles!${TABLES[kind].table}_author_id_fkey(name)`;
}

/** Backblasts' list columns, kept for existing callers. */
export const LIST_COLUMNS = listColumns("backblast");

export function tableFor(kind: ItemKind) {
  return TABLES[kind].table;
}

/** Tags rows loaded from a table with their kind. */
export function asItems(kind: ItemKind, rows: unknown): ListItem[] {
  return ((rows ?? []) as Omit<ListItem, "kind">[]).map((row) => ({
    ...row,
    kind,
  }));
}

/** Where a row opens: the editor for a draft, else the finished page. */
export function itemHref(item: Pick<ListItem, "kind" | "id" | "status">) {
  if (item.kind === "workout")
    return item.status === "draft"
      ? `/workouts/edit?id=${item.id}`
      : `/workout?id=${item.id}`;
  return item.status === "draft"
    ? `/backblasts/edit?id=${item.id}`
    : `/backblast?id=${item.id}`;
}

/** The IDs of what the signed-in user has archived, newest first. */
export async function loadArchivedIds(
  kind: ItemKind = "backblast",
): Promise<string[]> {
  const { archives, key } = TABLES[kind];
  const { data, error } = await createClient()
    .from(archives)
    .select(key)
    .order("archived_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, string>[]).map(
    (row) => row[key]!,
  );
}

/**
 * Fired once a workout or backblast is deleted, archived or unarchived, so lists showing it load
 * again. (A swipe's delete waits for Undo, and can finish after the next screen has loaded.)
 */
export const LISTS_CHANGED_EVENT = "rocket-lists-changed";

function listsChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(LISTS_CHANGED_EVENT));
}

export async function archive(id: string, kind: ItemKind = "backblast") {
  const { archives, key } = TABLES[kind];
  const { error } = await createClient()
    .from(archives)
    .upsert({ [key]: id } as never, { onConflict: `user_id,${key}` });
  if (error) throw new Error(error.message);
  listsChanged();
}

export async function unarchive(id: string, kind: ItemKind = "backblast") {
  const { archives, key } = TABLES[kind];
  const { error } = await createClient()
    .from(archives)
    .delete()
    // The two archive tables name their key column differently; the union confuses the types.
    .eq(key as "user_id", id);
  if (error) throw new Error(error.message);
  listsChanged();
}

export async function deleteItem(id: string, kind: ItemKind = "backblast") {
  const { error } = await createClient()
    .from(TABLES[kind].table)
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  listsChanged();
}

/** Deletes a backblast. */
export const deleteBackblast = (id: string) => deleteItem(id, "backblast");

/** Today as YYYY-MM-DD in local time, to compare with workout and backblast dates. */
export function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Whether a workout's date is still to come. Its backblast can be written only on the day or
 * after, once it has happened.
 */
export function isUpcoming(date: string | null | undefined): boolean {
  return !!date && date > localToday();
}

/**
 * Newest workout date first, undated ones last; a stable sort, so ties keep their order. For
 * lists put together from more than one query (Home's drafts).
 */
export function byWorkoutDate(a: ListItem, b: ListItem): number {
  if (a.date === b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date < b.date ? 1 : -1;
}

/**
 * Your drafts and your finished ones of a kind, each by workout date, the most recent on top
 * (undated ones last). Others' public workouts are on Discover, not here. What you've archived is
 * left out.
 */
async function loadListsFresh(
  kind: ItemKind,
  userId: string,
  limit = 50,
  /** Leave out finished ones dated after today (Home lists those as Future workouts). */
  pastOnly = false,
): Promise<{ drafts: ListItem[]; published: ListItem[] }> {
  const supabase = createClient();
  const archived = await loadArchivedIds(kind);
  const notArchived = `(${archived.join(",")})`;
  let drafts = supabase
    .from(tableFor(kind))
    .select(listColumns(kind))
    .eq("status", "draft")
    .eq("author_id", userId)
    .order("date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  let published = supabase
    .from(tableFor(kind))
    .select(listColumns(kind))
    .eq("status", "published")
    .eq("author_id", userId)
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (archived.length) {
    drafts = drafts.not("id", "in", notArchived);
    published = published.not("id", "in", notArchived);
  }
  if (pastOnly)
    published = published.or(`date.is.null,date.lte.${localToday()}`);
  const [d, p] = await Promise.all([drafts, published]);
  if (d.error || p.error) throw new Error((d.error ?? p.error)!.message);
  // Sorted here too, so the order holds however the rows arrive.
  return {
    drafts: asItems(kind, d.data).sort(byWorkoutDate),
    published: asItems(kind, p.data).sort(byWorkoutDate),
  };
}

/**
 * Your finished workouts dated today. Archived ones are included: archiving only hides them from
 * your Workouts and Backblasts lists.
 */
async function loadTodaysWorkoutsFresh(
  userId: string,
): Promise<(ListItem & { time: string | null })[]> {
  const query = createClient()
    .from("workouts")
    .select(`${listColumns("workout")}, time`)
    .eq("status", "published")
    .eq("author_id", userId)
    .eq("date", localToday());
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return asItems("workout", data) as (ListItem & { time: string | null })[];
}

/** Your finished workouts dated after today, soonest first, archived ones included. */
async function loadFutureWorkoutsFresh(
  userId: string,
  limit = 50,
): Promise<ListItem[]> {
  const query = createClient()
    .from("workouts")
    .select(listColumns("workout"))
    .eq("status", "published")
    .eq("author_id", userId)
    .gt("date", localToday())
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return asItems("workout", data);
}

/**
 * Your finished workouts that don't have a backblast yet, newest first (archived ones included).
 * Only the workout's Q writes its backblast.
 */
async function loadWorkoutsNeedingBackblastFresh(
  userId: string,
): Promise<ListItem[]> {
  const supabase = createClient();
  const [written, workouts] = await Promise.all([
    supabase
      .from("backblasts")
      .select("workout_id")
      .not("workout_id", "is", null),
    supabase
      .from("workouts")
      .select(listColumns("workout"))
      .eq("status", "published")
      // Only your own: a backblast is written by the workout's Q.
      .eq("author_id", userId)
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (written.error) throw new Error(written.error.message);
  if (workouts.error) throw new Error(workouts.error.message);
  const skip = new Set(
    (written.data ?? []).map((row) => row.workout_id as string),
  );
  return asItems("workout", workouts.data)
    .filter((w) => !skip.has(w.id))
    .sort(byWorkoutDate);
}

/** Links one of your backblasts to one of your workouts. */
export async function linkBackblast(backblastId: string, workoutId: string) {
  const { error } = await createClient()
    .from("backblasts")
    .update({ workout_id: workoutId })
    .eq("id", backblastId);
  if (error) throw new Error(error.message);
}

// Each list comes with its last kept copy, for offline (see lib/kept.ts).

/**
 * Your drafts and your finished ones of a kind, each by workout date, the most recent on top
 * (undated ones last). Others' public workouts are on Discover, not here. What you've archived is
 * left out. Offline, the last copy kept on this device.
 */
export function loadLists(
  kind: ItemKind,
  userId: string,
  limit = 50,
  /** Leave out finished ones dated after today (Home lists those as Future workouts). */
  pastOnly = false,
): Promise<{ drafts: ListItem[]; published: ListItem[] }> {
  return withKeptCopy(`lists:${kind}:${userId}:${limit}:${pastOnly}`, () =>
    loadListsFresh(kind, userId, limit, pastOnly),
  );
}

/** Your finished workouts dated today (archived ones included); offline, the kept copy. */
export function loadTodaysWorkouts(
  userId: string,
): Promise<(ListItem & { time: string | null })[]> {
  // Kept by day, so yesterday's copy never shows as today's.
  return withKeptCopy(`today:${userId}:${localToday()}`, () =>
    loadTodaysWorkoutsFresh(userId),
  );
}

/** Your finished workouts dated after today, soonest first; offline, the kept copy. */
export async function loadFutureWorkouts(
  userId: string,
  limit = 50,
): Promise<ListItem[]> {
  const list = await withKeptCopy(`future:${userId}:${limit}`, () =>
    loadFutureWorkoutsFresh(userId, limit),
  );
  // A copy kept on an earlier day may hold one that's today now.
  const today = localToday();
  return list.filter((w) => !w.date || w.date > today);
}

/** Your finished workouts with no backblast yet, newest first; offline, the kept copy. */
export function loadWorkoutsNeedingBackblast(
  userId: string,
): Promise<ListItem[]> {
  return withKeptCopy(`needs-backblast:${userId}`, () =>
    loadWorkoutsNeedingBackblastFresh(userId),
  );
}
