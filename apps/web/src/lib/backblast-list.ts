import { createClient } from "./supabase/client";

/** A backblast as shown in a list. */
export interface ListItem {
  id: string;
  title: string;
  date: string | null;
  ao: string;
  status: "draft" | "published";
  author_id: string;
  author: { name: string } | null;
}

export const LIST_COLUMNS =
  "id, title, date, ao, status, author_id, author:profiles(name)";

/** The IDs of the backblasts the signed-in user has archived, newest first. */
export async function loadArchivedIds(): Promise<string[]> {
  const { data, error } = await createClient()
    .from("backblast_archives")
    .select("backblast_id")
    .order("archived_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.backblast_id);
}

export async function archive(id: string) {
  const { error } = await createClient()
    .from("backblast_archives")
    .upsert({ backblast_id: id }, { onConflict: "user_id,backblast_id" });
  if (error) throw new Error(error.message);
}

export async function unarchive(id: string) {
  const { error } = await createClient()
    .from("backblast_archives")
    .delete()
    .eq("backblast_id", id);
  if (error) throw new Error(error.message);
}

export async function deleteBackblast(id: string) {
  const { error } = await createClient()
    .from("backblasts")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
