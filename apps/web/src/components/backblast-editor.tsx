"use client";

import type { Backblast } from "@rocket/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadWorkout,
  saveWorkoutNotes,
  toInsert,
  toWorkoutInsert,
} from "@/lib/backblast";
import { isUpcoming } from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { BackblastForm, type FormMode } from "./backblast-form";
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

function statusLabel(state: SaveState, published: boolean): string {
  switch (state) {
    case "new":
      return published ? "Saved" : "Draft";
    case "saving":
      return "Saving…";
    case "saved":
      return published ? "Saved" : "Draft saved";
    case "error":
      return "Not saved";
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
    finish: "Save workout",
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
    finish: "Finish draft",
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
  initial,
}: {
  mode?: FormMode;
  user: CurrentUser;
  /** The backblast being edited, or undefined for a new one. */
  draftId?: string;
  /** Whether the backblast being edited is already published. */
  published?: boolean;
  initial: Backblast;
}) {
  const router = useRouter();
  const words = WORDS[mode];
  const [loaded, setLoaded] = useState<{
    templates: SectionTemplate[];
    start: Backblast;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(
    draftId && !published ? "saved" : "new",
  );
  // Once changed, a finished one goes back to being a draft until it's saved again.
  const [edited, setEdited] = useState(false);
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    createClient()
      .from("section_templates")
      .select(TEMPLATE_COLUMNS)
      .order("name")
      .then(({ data }) => {
        const templates = data ?? [];
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
        const start =
          mode === "workout" || loaded.q.trim()
            ? loaded
            : { ...loaded, q: user.name };
        latest.current = start;
        setLoaded({ templates, start });
      });
  }, [draftId, user.name, mode]);

  /** Writes the latest content, one save at a time so a new draft is only created once. */
  const persist = useCallback(
    (status: "draft" | "published") => {
      const run = queue.current.then(async () => {
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
          const { data, error } = await table
            .insert({
              ...row,
              author_id: user.id,
              // New ones start public or private as chosen in Settings.
              visibility:
                mode === "workout"
                  ? user.defaultWorkoutVisibility
                  : user.defaultBackblastVisibility,
            } as never)
            .select("id")
            .single();
          if (error) throw error;
          id.current = data.id;
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
    ],
  );

  // Edits save as a draft (a finished one goes back to a draft) until the last page's button.
  const saveNow = useCallback(() => {
    timer.current = null;
    persist("draft").then(
      () => setSaveState((state) => (timer.current ? state : "saved")),
      () => setSaveState("error"),
    );
  }, [persist]);

  const onChange = useCallback(
    (backblast: Backblast) => {
      latest.current = backblast;
      setEdited(true);
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(saveNow, AUTOSAVE_DELAY_MS);
    },
    [saveNow],
  );

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
        onCopyWorkout={
          mode === "backblast" && loaded.start.workoutId
            ? () => loadWorkout(loaded.start.workoutId!)
            : undefined
        }
        heading={
          published ? words.published : draftId ? words.draft : words.new
        }
        status={statusLabel(saveState, published && !edited)}
        saveLabel={
          published && mode === "backblast" ? "Save backblast" : words.finish
        }
        initial={loaded.start}
        userId={user.id}
        initialTemplates={loaded.templates}
        onChange={onChange}
        onSave={async (backblast) => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          latest.current = backblast;
          try {
            await persist("published");
          } catch (error) {
            return (error as { message?: string }).message ?? words.failed;
          }
          // The page says what its Public / Private switch is for, just after a save.
          const view = `${words.view}?id=${id.current}&saved=1`;
          // A public workout before its day is hidden from others: say so, unless that's silenced.
          if (
            mode === "workout" &&
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
