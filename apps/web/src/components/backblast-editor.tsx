"use client";

import type { Backblast } from "@rocket/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseAttendees, toInsert } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { BackblastForm } from "./backblast-form";
import { TEMPLATE_COLUMNS, type SectionTemplate } from "./section-templates";

/** Fills in each section that has a default template. */
function withDefaults(
  backblast: Backblast,
  templates: SectionTemplate[],
): Backblast {
  const filled = { ...backblast };
  for (const template of templates) {
    if (!template.is_default) continue;
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
      filled[template.section] = template.body;
    }
  }
  return filled;
}

/** How long to wait after the last edit before saving the draft. */
const AUTOSAVE_DELAY_MS = 800;

type SaveState = "new" | "saving" | "saved" | "error" | "published" | "unsaved";

const STATUS_LABELS: Record<SaveState, string> = {
  new: "Draft",
  saving: "Saving…",
  saved: "Draft saved",
  error: "Not saved",
  published: "Published",
  unsaved: "Unsaved changes",
};

/**
 * Edits a backblast. Drafts save to Supabase as you type (a new one is created on the first edit)
 * and "Save backblast" publishes them. A published backblast only changes when you save, so
 * readers never see half-finished edits.
 */
export function BackblastEditor({
  user,
  draftId,
  published = false,
  initial,
}: {
  user: CurrentUser;
  /** The backblast being edited, or undefined for a new one. */
  draftId?: string;
  /** Whether the backblast being edited is already published. */
  published?: boolean;
  initial: Backblast;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{
    templates: SectionTemplate[];
    start: Backblast;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(
    published ? "published" : draftId ? "saved" : "new",
  );
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
        // A new backblast starts with the user's default templates filled in.
        const start = draftId
          ? initialRef.current
          : withDefaults(initialRef.current, templates);
        latest.current = start;
        setLoaded({ templates, start });
      });
  }, [draftId]);

  /** Writes the latest content, one save at a time so a new draft is only created once. */
  const persist = useCallback(
    (status: "draft" | "published") => {
      const run = queue.current.then(async () => {
        const supabase = createClient();
        const row = { ...toInsert(latest.current), status };
        if (id.current) {
          const { error } = await supabase
            .from("backblasts")
            .update(row)
            .eq("id", id.current);
          if (error) throw error;
          return;
        }
        const { data, error } = await supabase
          .from("backblasts")
          .insert({ ...row, author_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        id.current = data.id;
        // Point the address bar at the draft, so a reload or the back button returns to it.
        window.history.replaceState(
          null,
          "",
          `${process.env.NEXT_PUBLIC_BASE_PATH}/backblasts/edit/?id=${data.id}`,
        );
      });
      queue.current = run.catch(() => {});
      return run;
    },
    [user.id],
  );

  const saveDraft = useCallback(() => {
    timer.current = null;
    persist("draft").then(
      () => setSaveState((state) => (timer.current ? state : "saved")),
      () => setSaveState("error"),
    );
  }, [persist]);

  const onChange = useCallback(
    (backblast: Backblast) => {
      latest.current = backblast;
      if (published) return setSaveState("unsaved");
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(saveDraft, AUTOSAVE_DELAY_MS);
    },
    [saveDraft, published],
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
      await createClient().from("backblasts").delete().eq("id", id.current);
    router.push("/");
  }

  if (!loaded) return <div className="card h-96 animate-pulse" />;

  return (
    <BackblastForm
      heading={
        published ? "Edit backblast" : draftId ? "Edit draft" : "New backblast"
      }
      status={STATUS_LABELS[saveState]}
      saveLabel={published ? "Save changes" : "Save backblast"}
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
          return (
            (error as { message?: string }).message ??
            "Couldn't save the backblast."
          );
        }
        router.push(`/backblast?id=${id.current}`);
      }}
      onDiscard={published ? undefined : discard}
    />
  );
}
