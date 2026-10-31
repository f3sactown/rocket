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

type SaveState = "new" | "saving" | "saved" | "error";

const STATUS_LABELS: Record<SaveState, string> = {
  new: "Draft",
  saving: "Saving…",
  saved: "Draft saved",
  error: "Not saved",
};

/**
 * Edits a backblast draft, saving it to Supabase as you type. The draft is created on the first
 * edit, and "Save backblast" publishes it.
 */
export function BackblastEditor({
  user,
  draftId,
  initial,
}: {
  user: CurrentUser;
  /** The draft being edited, or undefined for a new backblast. */
  draftId?: string;
  initial: Backblast;
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<SectionTemplate[] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(
    draftId ? "saved" : "new",
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
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(saveDraft, AUTOSAVE_DELAY_MS);
    },
    [saveDraft],
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

  if (!templates) return <div className="card h-96 animate-pulse" />;

  return (
    <BackblastForm
      heading={draftId ? "Edit draft" : "New backblast"}
      status={STATUS_LABELS[saveState]}
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
      onDiscard={async () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        await queue.current;
        if (id.current)
          await createClient().from("backblasts").delete().eq("id", id.current);
        router.push("/");
      }}
    />
  );
}
