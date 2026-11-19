"use client";

import { withKeptCopy } from "@/lib/kept";
import type { Backblast } from "@rocket/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveWorkoutNotes, toInsert, toWorkoutInsert } from "@/lib/backblast";
import { isUpcoming } from "@/lib/backblast-list";
import { useConnection } from "@/lib/connection";
import {
  alreadyThere,
  backupKey,
  dropBackup,
  localBackblastFor,
  newBackupKey,
  openKeys,
  ownedBy,
  readBackup,
  writeBackup,
} from "@/lib/local-drafts";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { BackblastForm, type FormMode } from "./backblast-form";
import { backblastScreens, markChanged, workoutScreens } from "@/lib/offline";
import { tourRunning } from "./app-tour";
import { HIDDEN_UNTIL_THE_DAY, NoticeDialog } from "./notice-dialog";
import {
  builtInTemplates,
  TEMPLATE_COLUMNS,
  type SectionTemplate,
} from "./section-templates";

/** The workout's sections, which a workout's defaults fill in. */
const WORKOUT_DEFAULTS = ["introduction", "warmup", "thang", "wordsOfWisdom"];

/**
 * The default-template sections a new one starts with. A backblast made from a workout takes those
 * sections from the workout instead.
 */
function defaultSections(mode: FormMode, backblast: Backblast): string[] {
  if (mode === "workout") return WORKOUT_DEFAULTS;
  const own = ["announcements", "secondF"];
  return backblast.workoutId ? own : [...own, ...WORKOUT_DEFAULTS];
}

/**
 * Fills in each of the form's sections that has a default template and is still empty: a saved
 * template starred as the default, or a built-in one chosen as the default.
 */
function withDefaults(
  backblast: Backblast,
  templates: SectionTemplate[],
  mode: FormMode,
  user: Pick<CurrentUser, "language" | "builtInDefaults">,
): Backblast {
  const filled = { ...backblast };
  const builtIns = builtInTemplates(user.language);
  const chosen = Object.entries(user.builtInDefaults).flatMap(
    ([section, name]) =>
      (builtIns[section] ?? [])
        .filter((t) => t.name === name)
        .map((t) => ({ ...t, section, is_default: true })),
  );
  for (const template of [...templates, ...chosen]) {
    if (!template.is_default) continue;
    if (!defaultSections(mode, backblast).includes(template.section)) continue;
    const section = template.section as
      | "introduction"
      | "warmup"
      | "thang"
      | "announcements"
      | "wordsOfWisdom"
      | "secondF";
    // Only an empty section is filled, so nothing already written is replaced.
    if (!filled[section]?.trim()) filled[section] = template.body;
  }
  return filled;
}

/** Whether the saved workout is public, so its date keeps it from others until the day. */
async function isPublic(id: string): Promise<boolean> {
  const { data } = await createClient()
    .from("workouts")
    .select("visibility")
    .eq("id", id)
    .maybeSingle();
  return data?.visibility !== "private";
}

/** How long to wait after the last edit before saving the draft. */
const AUTOSAVE_DELAY_MS = 800;

type SaveState = "new" | "saving" | "saved" | "error";

/**
 * How long ago it was last saved, in steps that grow as it gets older: "just now", then 5, 10 and
 * 15 sec; every 10 sec to a minute; every 15 sec to 2 min; every 30 sec to 3 min; then every
 * minute ("4 min ago"), then hours and days.
 */
function savedAgo(at: Date, now: number): string {
  const seconds = Math.floor((now - at.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) {
    const step = seconds < 20 ? 5 : 10;
    return `${seconds - (seconds % step)} sec ago`;
  }
  if (seconds < 180) {
    const step = seconds < 120 ? 15 : 30;
    const shown = seconds - (seconds % step);
    const min = Math.floor(shown / 60);
    const sec = shown % 60;
    return sec ? `${min} min ${sec} sec ago` : `${min} min ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function statusLabel(
  state: SaveState,
  savedAt: Date | null,
  now: number,
  offline: boolean,
): string {
  switch (state) {
    case "new":
      return "Saves as you type";
    case "saving":
      return "Saving…";
    case "saved":
      return savedAt ? `Saved ${savedAgo(savedAt, now)}` : "Saved";
    case "error":
      return offline
        ? "Offline · saved locally"
        : "Not saved yet · kept on this phone";
  }
}

const WORDS = {
  workout: {
    table: "workouts",
    edit: "/workouts/edit/",
    view: "/workout",
    list: "/workouts",
    new: "New workout",
    draft: "Edit workout draft",
    published: "Edit workout",
    finish: "Done",
    failed: "Couldn't save the workout.",
  },
  backblast: {
    table: "backblasts",
    edit: "/backblasts/edit/",
    view: "/backblast",
    list: "/backblasts",
    new: "New backblast",
    draft: "Edit draft",
    published: "Edit backblast",
    finish: "Done",
    failed: "Couldn't save the backblast.",
  },
} as const;

/**
 * Edits a workout or a backblast. Changes save to Supabase as you type: a new draft is created on
 * the first edit, and the last page's button finishes it. Edits to a finished one save the same
 * way.
 */
export function BackblastEditor({
  mode = "backblast",
  user,
  draftId,
  published = false,
  savedAt,
  initial,
  fixedDate,
  localId: localIdProp,
}: {
  mode?: FormMode;
  user: CurrentUser;
  /** The backblast being edited, or undefined for a new one. */
  draftId?: string;
  /** Whether the backblast being edited is already published. */
  published?: boolean;
  /** When the one being edited was last saved. */
  savedAt?: string;
  initial: Backblast;
  /** A date it keeps, which can't be changed (the app tour's workout is today's). */
  fixedDate?: string;
  /** A new one already started on the phone (`?local=`), to carry on with. */
  localId?: string;
}) {
  const router = useRouter();
  const words = WORDS[mode];
  const [loaded, setLoaded] = useState<{
    templates: SectionTemplate[];
    start: Backblast;
  } | null>(null);
  // An existing one opens as saved, with when it was last saved; a new one saves once typed in.
  const [saveState, setSaveState] = useState<SaveState>(
    draftId ? "saved" : "new",
  );
  // When it was saved in this visit; one just opened shows plain "Saved" until it saves again.
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // The time now, so "Saved 3 min ago" keeps counting.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  // Where to go once the saved notice is closed.
  const [notice, setNotice] = useState<string | null>(null);
  const id = useRef(draftId ?? null);
  const latest = useRef(initial);
  // The starting content; later renders may pass a new object, but the form keeps its own state.
  const initialRef = useRef(initial);
  // The defaults as the editor opened; starring a template while editing doesn't refill it.
  const startUser = useRef({
    language: user.language,
    builtInDefaults: user.builtInDefaults,
  });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Where this one's unsaved copy is kept: a new one's under an ID made on the phone (the one
  // already started for its workout, for a backblast) until Rocket gives it its own.
  const [localId] = useState(
    () =>
      localIdProp ??
      (mode === "backblast" && initial.workoutId
        ? localBackblastFor(initial.workoutId, user.id)
        : null) ??
      crypto.randomUUID(),
  );
  const newKey = newBackupKey(mode, localId);
  // Inside the hidden frames that keep copies for offline use: look, don't save.
  const inFrame = typeof window !== "undefined" && window.top !== window;
  // Done tapped offline: finished as soon as the connection's back.
  const finishPending = useRef(false);
  // Whether Rocket knows it's offline (the phone says so, or requests aren't getting through).
  const { offline } = useConnection();
  const offlineRef = useRef(offline);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);
  const keyFor = useCallback(
    () => (id.current ? backupKey(mode, id.current) : newKey),
    [mode, newKey],
  );
  const restore = useRef<Backblast | null>(null);
  // Whether the last save failed, so reconnecting retries it (and nothing else).
  const failed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Offline, the templates last loaded on this device.
    withKeptCopy(`templates:${user.id}`, async () => {
      const { data, error } = await createClient()
        .from("section_templates")
        .select(TEMPLATE_COLUMNS)
        .order("name");
      if (error) throw error;
      return data ?? [];
    })
      .catch(() => [])
      .then((templates) => {
        // A new one starts with the user's default templates filled in.
        const loaded = draftId
          ? initialRef.current
          : withDefaults(
              initialRef.current,
              templates,
              mode,
              startUser.current,
            );
        // The person writing a backblast is the Q unless they say otherwise.
        const fresh =
          mode === "workout" || loaded.q.trim()
            ? loaded
            : { ...loaded, q: user.name };
        // Changes kept on the phone that never reached Rocket (newer than its last save) come back.
        const found = readBackup(draftId ? backupKey(mode, draftId) : newKey);
        // Another account's copy (signed in on this phone) isn't brought back here.
        const backup = found && ownedBy(found, user.id) ? found : null;
        const kept =
          backup &&
          (!savedAt || backup.at > Date.parse(savedAt)) &&
          backup.content;
        const start = kept || fresh;
        restore.current = kept || null;
        latest.current = start;
        setLoaded({ templates, start });
      });
    // `savedAt` and the backup key are fixed for this editor; only these reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, user.name, mode]);

  /** Writes the latest content, one save at a time so a new draft is only created once. */
  const persist = useCallback(
    (status: "draft" | "published") => {
      const run = queue.current.then(async () => {
        // Known to be offline: kept on the phone (by onChange) and sent once the connection's
        // back, rather than waiting on a request that may never be answered.
        if (offlineRef.current) throw new Error("Offline: kept on this phone");
        const supabase = createClient();
        const fields =
          mode === "workout"
            ? toWorkoutInsert(latest.current)
            : toInsert(latest.current);
        const row = { ...fields, status };
        // Both tables take the same shape of update; the union of their types doesn't.
        const table = supabase.from(words.table as "backblasts");
        if (id.current) {
          // The database keeps a backblast linked to the workout at its AO and date, and a link
          // made on its page stays; so edits leave the link alone rather than send the form's.
          const changes: Record<string, unknown> = { ...row };
          if (mode === "backblast") delete changes.workout_id;
          const { error } = await table
            .update(changes as never)
            .eq("id", id.current);
          if (error) throw error;
        } else {
          // Made under the phone's ID for it, so it's the same one however often it's sent (the
          // kept copy may have reached Rocket already, from another screen).
          const { error } = await table.insert({
            ...row,
            id: localId,
            author_id: user.id,
            // New ones start public or private as chosen in Settings.
            visibility:
              mode === "workout"
                ? user.defaultWorkoutVisibility
                : user.defaultBackblastVisibility,
          } as never);
          if (error && !alreadyThere(error)) throw error;
          if (error) {
            // Already there: this is it, so the latest goes to it.
            const changes: Record<string, unknown> = { ...row };
            if (mode === "backblast") delete changes.workout_id;
            const { error: updateError } = await table
              .update(changes as never)
              .eq("id", localId);
            if (updateError) throw updateError;
          }
          const data = { id: localId };
          id.current = data.id;
          openKeys.add(backupKey(mode, data.id));
          // Point the address bar at the draft, so a reload or the back button returns to it.
          window.history.replaceState(
            null,
            "",
            `${process.env.NEXT_PUBLIC_BASE_PATH}${words.edit}?id=${data.id}`,
          );
        }
        // A workout's notes are private to its Q, so they're saved apart from the workout.
        if (mode === "workout")
          await saveWorkoutNotes(id.current, latest.current.notes ?? "");
        // Its copies for offline use are kept again (once you leave), with its workout's.
        markChanged(
          mode === "workout"
            ? workoutScreens(id.current)
            : [
                ...backblastScreens(id.current),
                ...(latest.current.workoutId
                  ? workoutScreens(latest.current.workoutId)
                  : []),
              ],
        );
      });
      queue.current = run.catch(() => {});
      return run;
    },
    [
      user.id,
      user.defaultWorkoutVisibility,
      user.defaultBackblastVisibility,
      mode,
      words,
      localId,
    ],
  );

  // Edits save as a draft (a finished one goes back to a draft) until the last page's button.
  const saveNow = useCallback(() => {
    timer.current = null;
    const saving = latest.current;
    persist("draft").then(
      () => {
        failed.current = false;
        setLastSaved(new Date());
        setNow(Date.now());
        setSaveState((state) => (timer.current ? state : "saved"));
        // Saved: the phone's copy isn't needed, unless more was typed meanwhile.
        if (latest.current === saving) dropBackup(keyFor(), newKey);
        else writeBackup(keyFor(), latest.current, user.id);
      },
      () => {
        failed.current = true;
        setSaveState("error");
      },
    );
  }, [persist, keyFor, newKey, user.id]);

  const onChange = useCallback(
    (backblast: Backblast) => {
      if (inFrame) return;
      latest.current = backblast;
      // Kept on the phone first, so a dropped connection or a closed app loses nothing.
      writeBackup(keyFor(), backblast, user.id);
      // A new one: its address names the phone's copy, so a reload (or the lists) bring it back.
      if (!id.current && !window.location.search.includes("local="))
        window.history.replaceState(
          null,
          "",
          `${process.env.NEXT_PUBLIC_BASE_PATH}${mode === "workout" ? "/workouts/new/" : "/backblasts/new/"}?local=${localId}${backblast.workoutId ? `&workout=${backblast.workoutId}` : ""}`,
        );
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(saveNow, AUTOSAVE_DELAY_MS);
    },
    [saveNow, keyFor, inFrame, localId, mode, user.id],
  );

  // While open, this editor saves its own copy; the background sender leaves it alone.
  useEffect(() => {
    const key = newKey;
    openKeys.add(key);
    if (draftId) openKeys.add(backupKey(mode, draftId));
    return () => {
      openKeys.delete(key);
      if (draftId) openKeys.delete(backupKey(mode, draftId));
      if (id.current) openKeys.delete(backupKey(mode, id.current));
    };
  }, [newKey, draftId, mode]);

  // Kept changes brought back on opening: save them now.
  useEffect(() => {
    if (!loaded || !restore.current) return;
    const content = restore.current;
    restore.current = null;
    const timer = setTimeout(() => onChange(content), 0);
    return () => clearTimeout(timer);
  }, [loaded, onChange]);

  // When the connection comes back, save what couldn't be saved (and finish it, if Done was
  // tapped meanwhile).
  const { reconnects } = useConnection();
  const retry = useCallback(() => {
    if (finishPending.current) {
      persist("published").then(
        () => {
          finishPending.current = false;
          dropBackup(keyFor(), newKey);
          router.push(`${words.view}?id=${id.current}&saved=1`);
        },
        () => {},
      );
      return;
    }
    if (failed.current && !timer.current) saveNow();
  }, [persist, saveNow, keyFor, newKey, router, words]);
  useEffect(() => {
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [retry]);
  useEffect(() => {
    if (reconnects) retry();
  }, [reconnects, retry]);

  // Don't lose the last edits when leaving the page before the autosave fires.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        persist("draft");
      }
    },
    [persist],
  );

  async function discard() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await queue.current;
    dropBackup(keyFor(), newKey);
    if (id.current)
      await createClient()
        .from(words.table as "backblasts")
        .delete()
        .eq("id", id.current);
    router.push(words.list);
  }

  if (!loaded) return <div className="card h-96 animate-pulse" />;

  return (
    <>
      <BackblastForm
        mode={mode}
        heading={
          published ? words.published : draftId ? words.draft : words.new
        }
        status={statusLabel(saveState, lastSaved, now, offline)}
        saveLabel={words.finish}
        initial={loaded.start}
        fixedDate={fixedDate}
        userId={user.id}
        initialTemplates={loaded.templates}
        // Offline, a workout's review can open Run workout: from the copy on this phone.
        onRun={
          mode === "workout" && offline
            ? () => {
                // What's typed is on the phone already (every change is); Run reads it there.
                router.push(
                  id.current
                    ? `/workout/run?id=${id.current}`
                    : `/workout/run?local=${localId}`,
                );
              }
            : undefined
        }
        onChange={onChange}
        onSave={async (backblast) => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          latest.current = backblast;
          try {
            await persist("published");
          } catch (error) {
            if (!navigator.onLine || isConnectionError(error)) {
              // Kept on the phone as finished: it's sent and finished once there's a connection.
              writeBackup(keyFor(), backblast, user.id, true);
              finishPending.current = true;
              return "You're offline. It's kept on this phone and will be finished as soon as you're back online.";
            }
            return (error as { message?: string }).message ?? words.failed;
          }
          finishPending.current = false;
          dropBackup(keyFor(), newKey);
          // The page says what its Public / Private switch is for, just after a save.
          const view = `${words.view}?id=${id.current}&saved=1`;
          // A public workout before its day is hidden from others: say so, unless that's silenced.
          if (
            mode === "workout" &&
            !tourRunning() &&
            !user.noticesOff.includes(HIDDEN_UNTIL_THE_DAY) &&
            isUpcoming(backblast.date) &&
            (await isPublic(id.current!))
          )
            setNotice(view);
          else router.push(view);
        }}
        onDiscard={published ? undefined : discard}
      />
      {notice && (
        <NoticeDialog
          id={HIDDEN_UNTIL_THE_DAY}
          title="Hidden until the day"
          onClose={() => router.push(notice)}
        >
          Other PAX won&apos;t see this workout until the day of the workout.
          Before then, only people you send its link to can open it.
        </NoticeDialog>
      )}
    </>
  );
}

/** Whether an error is the connection failing, not Rocket refusing the save. */
function isConnectionError(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? "";
  return /fetch|network|load failed|internet|offline|kept on this phone/i.test(
    message,
  );
}
