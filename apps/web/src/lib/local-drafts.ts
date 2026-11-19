"use client";

import type { Backblast } from "@rocket/core";
import { saveWorkoutNotes, toInsert, toWorkoutInsert } from "./backblast";
import { createClient } from "./supabase/client";

/**
 * Workouts and backblasts kept on the phone until they reach Rocket: everything typed is kept
 * here first, so a dropped connection (or no connection at all, at an AO) or a closed app loses
 * nothing. An open editor saves its own; the rest are sent by `sendLocalDrafts` whenever there's
 * a connection: new ones are created as drafts (or finished, if Done was tapped offline), changes
 * to existing ones are saved to them.
 */

export type DraftKind = "workout" | "backblast";

export interface Backup {
  /** When it was typed (ms). */
  at: number;
  content: Backblast;
  /** Done was tapped offline: it's finished once it's sent, not left a draft. */
  publish?: boolean;
  /** Whose it is: only sent, listed or reopened while that account is signed in. */
  userId?: string;
}

const PREFIX = "rocket-unsaved:";
/** A new one's key holds "new-" and an ID made on the phone, until Rocket gives it its own. */
const NEW = "new-";

export const backupKey = (kind: DraftKind, id: string) =>
  `${PREFIX}${kind}:${id}`;
export const newBackupKey = (kind: DraftKind, localId: string) =>
  backupKey(kind, `${NEW}${localId}`);

export function readBackup(key: string): Backup | null {
  try {
    const raw = localStorage.getItem(key);
    const backup = raw ? (JSON.parse(raw) as Backup) : null;
    return backup && typeof backup.at === "number" && backup.content
      ? backup
      : null;
  } catch {
    return null;
  }
}

export function writeBackup(
  key: string,
  content: Backblast,
  userId: string,
  publish = false,
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        at: Date.now(),
        content,
        publish,
        userId,
      } satisfies Backup),
    );
  } catch {
    // No room or no storage: it still saves to Rocket as usual.
  }
}

export function dropBackup(...keys: string[]) {
  try {
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Nothing kept.
  }
  window.dispatchEvent(new Event(LOCAL_DRAFTS_EVENT));
}

/** Fired when what's kept on the phone changes (one's saved, or sent to Rocket). */
export const LOCAL_DRAFTS_EVENT = "rocket-local-drafts";

/** Keys an open editor is saving itself (the sender leaves those alone). */
export const openKeys = new Set<string>();

export interface LocalDraft {
  key: string;
  kind: DraftKind;
  /** Rocket's ID, for changes to one that's already there; null for a new one. */
  id: string | null;
  /** The phone's ID for a new one (its editor's `?local=`). */
  localId: string | null;
  backup: Backup;
}

/** Whether a kept copy is this account's (one kept before accounts were noted counts as anyone's). */
export const ownedBy = (backup: Backup, userId: string) =>
  !backup.userId || backup.userId === userId;

/** Everything kept on the phone (for one account, given its ID), newest first. */
export function localDrafts(kind?: DraftKind, userId?: string): LocalDraft[] {
  const found: LocalDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const [k, id] = key.slice(PREFIX.length).split(":") as [
        DraftKind,
        string,
      ];
      if (k !== "workout" && k !== "backblast") continue;
      if (kind && k !== kind) continue;
      const backup = readBackup(key);
      if (!backup || !id) continue;
      if (userId && !ownedBy(backup, userId)) continue;
      const isNew = id.startsWith(NEW);
      found.push({
        key,
        kind: k,
        id: isNew ? null : id,
        localId: isNew ? id.slice(NEW.length) : null,
        backup,
      });
    }
  } catch {
    // No storage.
  }
  return found.sort((a, b) => b.backup.at - a.backup.at);
}

/** A new backblast for this workout already started on the phone, so it's carried on, not doubled. */
export function localBackblastFor(
  workoutId: string,
  userId: string,
): string | null {
  return (
    localDrafts("backblast", userId).find(
      (d) => d.localId && d.backup.content.workoutId === workoutId,
    )?.localId ?? null
  );
}

/** Where a new one kept on the phone opens to carry on. */
export function localDraftHref(draft: LocalDraft): string {
  if (draft.id)
    return `/${draft.kind === "workout" ? "workouts" : "backblasts"}/edit?id=${draft.id}`;
  const workout = draft.backup.content.workoutId;
  return draft.kind === "workout"
    ? `/workouts/new?local=${draft.localId}`
    : `/backblasts/new?local=${draft.localId}${workout ? `&workout=${workout}` : ""}`;
}

/**
 * Whether creating one failed because it's already there under that ID: sent once already (from
 * this phone's kept copy), so this isn't a new one.
 */
export const alreadyThere = (error: { code?: string; message?: string }) =>
  error.code === "23505" && /_pkey\b/.test(error.message ?? "");

let sending: Promise<number> | null = null;

/**
 * Sends what's kept on the phone to Rocket (not what an open editor is saving itself): returns
 * how many reached it. A change kept on the phone isn't sent over a newer save from elsewhere.
 */
export function sendLocalDrafts(user: {
  id: string;
  defaultWorkoutVisibility: "public" | "private";
  defaultBackblastVisibility: "public" | "private";
}): Promise<number> {
  if (typeof window === "undefined" || window.top !== window)
    return Promise.resolve(0);
  if (!navigator.onLine) return Promise.resolve(0);
  sending ??= (async () => {
    let sent = 0;
    // Only this account's: another account's wait for it to sign in again.
    for (const draft of localDrafts(undefined, user.id)) {
      if (openKeys.has(draft.key)) continue;
      try {
        if (await send(draft, user)) sent++;
      } catch {
        // Still no connection, or it failed: kept, and tried again next time.
      }
    }
    return sent;
  })().finally(() => {
    sending = null;
    window.dispatchEvent(new Event(LOCAL_DRAFTS_EVENT));
  });
  return sending;
}

async function send(
  draft: LocalDraft,
  user: {
    id: string;
    defaultWorkoutVisibility: "public" | "private";
    defaultBackblastVisibility: "public" | "private";
  },
): Promise<boolean> {
  const supabase = createClient();
  const { content, publish, at } = draft.backup;
  const table = draft.kind === "workout" ? "workouts" : "backblasts";
  const fields =
    draft.kind === "workout" ? toWorkoutInsert(content) : toInsert(content);
  const row = { ...fields, status: publish ? "published" : "draft" };
  let id = draft.id;
  if (id) {
    const { data: current, error: readError } = await supabase
      .from(table)
      .select("updated_at")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    // Gone, or saved since from somewhere else: the phone's copy is out of date.
    if (!current || Date.parse(current.updated_at) > at) {
      dropBackup(draft.key);
      return false;
    }
    const changes: Record<string, unknown> = { ...row };
    // The database keeps a backblast's link to its workout; edits leave it alone.
    if (draft.kind === "backblast") delete changes.workout_id;
    const { error } = await supabase
      .from(table as "backblasts")
      .update(changes as never)
      .eq("id", id);
    if (error) throw error;
  } else {
    // Made under the phone's own ID, so sending it twice (the app closed just as it was sent,
    // say) can't make two: the second finds it there and saves the latest to it.
    id = draft.localId!;
    const { error } = await supabase.from(table as "backblasts").insert({
      ...row,
      id,
      author_id: user.id,
      visibility:
        draft.kind === "workout"
          ? user.defaultWorkoutVisibility
          : user.defaultBackblastVisibility,
    } as never);
    if (error && !alreadyThere(error)) throw error;
    if (error) {
      const changes: Record<string, unknown> = { ...row };
      if (draft.kind === "backblast") delete changes.workout_id;
      const { error: updateError } = await supabase
        .from(table as "backblasts")
        .update(changes as never)
        .eq("id", id);
      if (updateError) throw updateError;
    }
  }
  if (draft.kind === "workout") await saveWorkoutNotes(id, content.notes ?? "");
  dropBackup(draft.key);
  return true;
}
