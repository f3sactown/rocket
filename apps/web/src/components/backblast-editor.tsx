"use client";

import { termsFor, type Backblast } from "@rocket/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadWorkout,
  saveWorkoutNotes,
  toInsert,
  toWorkoutInsert,
  updateWorkoutFromBackblast,
  workoutDifferences,
  type SharedSection,
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

/** When it was last saved, as people read it: "Nov 16, 5:42am". */
function savedTime(at: Date): string {
  const date = at.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const time = at
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(/\s?([AP])M$/i, (_, h: string) => `${h.toLowerCase()}m`);
  return `${date}, ${time}`;
}

/** The header's save state: "Saving…" while it saves, then "Saved" with when. */
function statusLabel(state: SaveState, savedAt: Date | null): string {
  switch (state) {
    case "new":
      return "Saves as you type";
    case "saving":
      return "Saving…";
    case "saved":
      return savedAt ? `Saved ${savedTime(savedAt)}` : "Saved";
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
  const [lastSaved, setLastSaved] = useState<Date | null>(
    savedAt ? new Date(savedAt) : null,
  );
  // A finished backblast's changes to its workout's sections, offered back to the workout.
  const [offer, setOffer] = useState<Offer | null>(null);
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
      () => {
        setLastSaved(new Date());
        setSaveState((state) => (timer.current ? state : "saved"));
      },
      () => setSaveState("error"),
    );
  }, [persist]);

  const onChange = useCallback(
    (backblast: Backblast) => {
      latest.current = backblast;
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
        status={statusLabel(saveState, lastSaved)}
        saveLabel={words.finish}
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
          // A backblast whose copy of its workout now differs from the workout: offer to update it.
          if (mode === "backblast") {
            const differs = await workoutDifferences(backblast, user.id).catch(
              () => null,
            );
            if (differs) return void setOffer({ ...differs, view, backblast });
          }
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
      {offer && (
        <UpdateWorkout
          offer={offer}
          language={user.language}
          onDone={() => router.push(offer.view)}
        />
      )}
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

interface Offer {
  workoutId: string;
  sections: SharedSection[];
  /** The backblast's page, to go to once answered. */
  view: string;
  backblast: Backblast;
}

/**
 * After finishing a backblast whose copy of its workout's sections now differs from the workout:
 * update the workout to match, or keep it as it was.
 */
function UpdateWorkout({
  offer,
  language,
  onDone,
}: {
  offer: Offer;
  language: CurrentUser["language"];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terms = termsFor(language);
  const names: Record<SharedSection, string> = {
    introduction: "Introduction",
    warmup: terms.warmup,
    thang: terms.thang,
    wordsOfWisdom: terms.wordsOfWisdom,
  };
  const chip =
    "rounded-full border border-line-strong px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-workout-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-2xl">
        <h2
          id="update-workout-title"
          className="text-lg font-semibold text-ink"
        >
          Update the workout too?
        </h2>
        <p className="text-sm text-ink-soft">
          {offer.sections.map((s) => names[s]).join(", ")} in this backblast{" "}
          {offer.sections.length === 1 ? "differs" : "differ"} from the workout.
          Update the workout to match, so it shows what was actually done?
          {offer.sections.includes("thang") &&
            ` The workout's timers and music for ${terms.thang} would be replaced by the backblast's text.`}
        </p>
        {error && <p className="text-sm text-accent">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const message = await updateWorkoutFromBackblast(
                offer.workoutId,
                offer.backblast,
                offer.sections,
              );
              if (message) {
                setError(message);
                setBusy(false);
              } else onDone();
            }}
            className={chip}
          >
            Update workout
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDone}
            className={chip}
          >
            Keep the workout as it is
          </button>
        </div>
      </div>
    </div>
  );
}
