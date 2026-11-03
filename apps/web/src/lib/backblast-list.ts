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
