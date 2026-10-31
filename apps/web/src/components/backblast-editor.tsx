"use client";

import type { Backblast } from "@rocket/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toInsert } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { BackblastForm } from "./backblast-form";
import type { SectionTemplate } from "./section-templates";

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
  const [templates, setTemplates] = useState<SectionTemplate[] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(
    published ? "published" : draftId ? "saved" : "new",
  );
  const id = useRef(draftId ?? null);
  const latest = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    createClient()
      .from("section_templates")
      .select("id, section, name, body")
      .order("name")
      .then(({ data }) => setTemplates(data ?? []));
  }, []);

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

  if (!templates) return <div className="card h-96 animate-pulse" />;

  return (
    <BackblastForm
      heading={
        published ? "Edit backblast" : draftId ? "Edit draft" : "New backblast"
      }
      status={STATUS_LABELS[saveState]}
      saveLabel={published ? "Save changes" : "Save backblast"}
      initial={initial}
      userId={user.id}
      initialTemplates={templates}
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
