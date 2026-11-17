"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConnection } from "@/lib/connection";
import {
  LOCAL_DRAFTS_EVENT,
  localDraftHref,
  localDrafts,
  sendLocalDrafts,
  type DraftKind,
  type LocalDraft,
} from "@/lib/local-drafts";
import { useAuth } from "./auth-provider";

/**
 * Sends what's kept on the phone to Rocket whenever there's a connection: when Rocket opens, when
 * the connection comes back, and every minute or so meanwhile (a save that failed for another
 * reason is tried again).
 */
export function DraftSender() {
  const { user } = useAuth();
  const { offline, reconnects } = useConnection();
  useEffect(() => {
    if (!user || user.needsProfile || offline) return;
    void sendLocalDrafts(user);
    const timer = setInterval(() => void sendLocalDrafts(user), 60_000);
    return () => clearInterval(timer);
  }, [user, offline, reconnects]);
  return null;
}

/** What's kept on the phone, kept up to date. */
export function useLocalDrafts(
  kind?: DraftKind,
  userId?: string,
): LocalDraft[] {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  useEffect(() => {
    const read = () => setDrafts(localDrafts(kind, userId));
    read();
    window.addEventListener(LOCAL_DRAFTS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(LOCAL_DRAFTS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [kind, userId]);
  return drafts;
}

/** Runs when drafts kept on the phone reach Rocket, so lists can load again and show them. */
export function useOnDraftsSent(onSent: () => void) {
  useEffect(() => {
    window.addEventListener(LOCAL_DRAFTS_EVENT, onSent);
    return () => window.removeEventListener(LOCAL_DRAFTS_EVENT, onSent);
  }, [onSent]);
}

/**
 * New workouts and backblasts kept on the phone that haven't reached Rocket yet (started offline,
 * say): tap one to carry on. They join the lists once they're sent.
 */
export function LocalDraftList({
  kind,
  title = "On this phone",
}: {
  kind?: DraftKind;
  title?: string;
}) {
  const { user } = useAuth();
  const drafts = useLocalDrafts(kind, user?.id).filter((d) => !d.id);
  const { offline } = useConnection();
  if (!drafts.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <ul className="panel flex flex-col divide-y divide-line p-2">
        {drafts.map((draft) => {
          const { content, publish } = draft.backup;
          return (
            <li key={draft.key}>
              <Link
                href={localDraftHref(draft)}
                className="flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-hover"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium text-ink">
                    {content.title.trim() ||
                      (draft.kind === "workout"
                        ? "Untitled workout"
                        : "Untitled backblast")}
                  </span>
                  <span className="truncate text-sm text-muted">
                    {[
                      draft.kind === "workout" ? "Workout" : "Backblast",
                      content.ao,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {content.date && (
                    <span className="font-mono text-sm text-ink-soft">
                      {content.date}
                    </span>
                  )}
                  <span className="rounded-full border border-line-strong px-2 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap text-ink-soft">
                    {offline
                      ? publish
                        ? "Finishes once online"
                        : "Saves once online"
                      : "Saving…"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
