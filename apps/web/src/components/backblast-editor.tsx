"use client";

import { qNames, type Backblast } from "@rocket/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadWorkout,
  parseAttendees,
  toInsert,
  toWorkoutInsert,
} from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { BackblastForm, type FormMode } from "./backblast-form";
import { TEMPLATE_COLUMNS, type SectionTemplate } from "./section-templates";

/** The default-template sections each form fills in when it starts. */
const DEFAULT_SECTIONS: Record<FormMode, string[]> = {
  workout: ["introduction"],
  backblast: ["attendees", "introduction", "thirdF", "secondF"],
};

/** Fills in each of the form's sections that has a default template and is still empty. */
function withDefaults(
  backblast: Backblast,
  templates: SectionTemplate[],
  mode: FormMode,
): Backblast {
  const filled = { ...backblast };
  for (const template of templates) {
    if (!template.is_default) continue;
    if (!DEFAULT_SECTIONS[mode].includes(template.section)) continue;
    if (template.section === "attendees") {
      try {
        filled.attendees = parseAttendees(JSON.parse(template.body));
      } catch {
        // Ignore a malformed roster rather than blocking the form.
      }
    } else if (
      template.section === "introduction" ||
      template.section === "thirdF" ||
      template.section === "secondF"
    ) {
      // A backblast's introduction comes from its workout when it has one.
      if (!filled[template.section]?.trim())
        filled[template.section] = template.body;
    }
  }
  return filled;
}

/** How long to wait after the last edit before saving the draft. */
const AUTOSAVE_DELAY_MS = 800;

type SaveState = "new" | "saving" | "saved" | "error" | "incomplete";

function statusLabel(state: SaveState, published: boolean): string {
  switch (state) {
    case "new":
      return published ? "Published" : "Draft";
    case "saving":
      return "Saving…";
    case "saved":
      return published ? "Saved" : "Draft saved";
    case "error":
      return "Not saved";
    case "incomplete":
      return "Not saved: add a title, date and AO (and the Q on a backblast)";
  }
}

/**
 * A finished workout keeps its title, date and AO, and a published backblast those and its Q, so
 * edits missing one wait to save.
 */
function hasBasics(backblast: Backblast, mode: FormMode): boolean {
  return (
    [backblast.title, backblast.date, backblast.ao].every((value) =>
      value?.trim(),
    ) &&
    (mode === "workout" || qNames(backblast).length > 0)
  );
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
    finish: "Finish workout",
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
  const status = published ? "published" : "draft";
  const id = useRef(draftId ?? null);
  const latest = useRef(initial);
  // The starting content; later renders may pass a new object, but the form keeps its own state.
  const initialRef = useRef(initial);
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
          : withDefaults(initialRef.current, templates, mode);
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
          const { error } = await table
            .update(row as never)
            .eq("id", id.current);
          if (error) throw error;
          return;
        }
        const { data, error } = await table
          .insert({ ...row, author_id: user.id } as never)
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
      });
      queue.current = run.catch(() => {});
      return run;
    },
    [user.id, mode, words],
  );

  const saveNow = useCallback(() => {
    timer.current = null;
    if (status === "published" && !hasBasics(latest.current, mode))
      return setSaveState("incomplete");
    persist(status).then(
      () => setSaveState((state) => (timer.current ? state : "saved")),
      () => setSaveState("error"),
    );
  }, [persist, status, mode]);

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
        if (status === "draft" || hasBasics(latest.current, mode))
          persist(status);
      }
    },
    [persist, status, mode],
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
    <BackblastForm
      mode={mode}
      onCopyWorkout={
        mode === "backblast" && loaded.start.workoutId
          ? () => loadWorkout(loaded.start.workoutId!)
          : undefined
      }
      heading={published ? words.published : draftId ? words.draft : words.new}
      status={statusLabel(saveState, published)}
      saveLabel={published ? "Done" : words.finish}
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
        router.push(`${words.view}?id=${id.current}`);
      }}
      onDiscard={published ? undefined : discard}
    />
  );
}
