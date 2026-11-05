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

export async function archive(id: string, kind: ItemKind = "backblast") {
  const { archives, key } = TABLES[kind];
  const { error } = await createClient()
    .from(archives)
    .upsert({ [key]: id } as never, { onConflict: `user_id,${key}` });
  if (error) throw new Error(error.message);
}

export async function unarchive(id: string, kind: ItemKind = "backblast") {
  const { archives, key } = TABLES[kind];
  const { error } = await createClient()
    .from(archives)
    .delete()
    // The two archive tables name their key column differently; the union confuses the types.
    .eq(key as "user_id", id);
  if (error) throw new Error(error.message);
}

export async function deleteItem(id: string, kind: ItemKind = "backblast") {
  const { error } = await createClient()
    .from(TABLES[kind].table)
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
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
 * Your drafts of a kind, most recently edited first, and your finished ones, newest first. Others'
 * public workouts are on Discover, not here. What you've archived is left out.
 */
export async function loadLists(
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
    .order("updated_at", { ascending: false })
    .limit(limit);
  let published = supabase
    .from(tableFor(kind))
    .select(listColumns(kind))
    .eq("status", "published")
    .eq("author_id", userId)
    .order("date", { ascending: false })
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
  return { drafts: asItems(kind, d.data), published: asItems(kind, p.data) };
}

/** Your finished workouts dated after today, soonest first, leaving out what you've archived. */
export async function loadFutureWorkouts(
  userId: string,
  limit = 50,
): Promise<ListItem[]> {
  const archived = await loadArchivedIds("workout");
  let query = createClient()
    .from("workouts")
    .select(listColumns("workout"))
    .eq("status", "published")
    .eq("author_id", userId)
    .gt("date", localToday())
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (archived.length) query = query.not("id", "in", `(${archived.join(",")})`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return asItems("workout", data);
}

/**
 * Finished workouts that don't have a backblast yet (one you can see: published, or your own
 * draft), newest first, leaving out what you've archived.
 */
export async function loadWorkoutsNeedingBackblast(): Promise<ListItem[]> {
  const supabase = createClient();
  const [archived, written, workouts] = await Promise.all([
    loadArchivedIds("workout"),
    supabase
      .from("backblasts")
      .select("workout_id")
      .not("workout_id", "is", null),
    supabase
      .from("workouts")
      .select(listColumns("workout"))
      .eq("status", "published")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (written.error) throw new Error(written.error.message);
  if (workouts.error) throw new Error(workouts.error.message);
  const skip = new Set([
    ...archived,
    ...(written.data ?? []).map((row) => row.workout_id as string),
  ]);
  return asItems("workout", workouts.data).filter((w) => !skip.has(w.id));
}
