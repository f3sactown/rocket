"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  archive,
  deleteBackblast,
  unarchive,
  type ListItem,
} from "@/lib/backblast-list";
import type { CurrentUser, SwipeAction } from "./auth-provider";
import { Highlight } from "./highlight";
import { SwipeRow, type SwipeOption } from "./swipe-row";

/** How long "Undo" stays up. A delete only happens once it's gone. */
const UNDO_MS = 5000;

const COLORS = { delete: "#c8372d", archive: "#3d6a85" };

export interface ListGroup {
  /** Heading above the group, e.g. "Your drafts". */
  title?: string;
  items: ListItem[];
  /** Shown when the group is empty; groups without one are hidden instead. */
  empty?: string;
}

interface Pending {
  message: string;
  undo: () => void;
  /** Runs when the undo time is up, e.g. the actual delete. */
  finish?: () => Promise<void>;
}

/**
 * Backblasts in one or more groups. Swipe a row to archive it (or unarchive, in the archive) or,
 * for your own, to delete it; which direction does which is set in Settings. Both can be undone
 * for a few seconds.
 */
export function BackblastList({
  user,
  groups,
  archived = false,
  highlight = [],
  snippets,
  onArchived,
  onDeleted,
}: {
  user: CurrentUser;
  groups: ListGroup[];
  /** Whether these are archived backblasts, which swipe to unarchive instead. */
  archived?: boolean | ((item: ListItem) => boolean);
  /** Words to highlight in titles. */
  highlight?: string[];
  /** Extra text under a row, e.g. where a search matched. */
  snippets?: Record<string, string>;
  /** Called once a backblast is archived or unarchived (including by Undo). */
  onArchived?: (id: string, archived: boolean) => void;
  /** Called once a backblast is deleted for good. */
  onDeleted?: (id: string) => void;
}) {
  // Rows swiped away, hidden here until the page reloads.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<Pending | null>(null);

  const hide = (id: string, on: boolean) =>
    setHidden((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Ends the undo window: runs anything still waiting, like a delete. */
  const settle = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const done = current.current;
    current.current = null;
    setPending(null);
    return done?.finish?.();
  }, []);

  // Leaving the page finishes a waiting delete rather than dropping it.
  useEffect(() => {
    window.addEventListener("pagehide", settle);
    return () => {
      window.removeEventListener("pagehide", settle);
      settle();
    };
  }, [settle]);

  function offerUndo(next: Pending) {
    settle();
    current.current = next;
    setPending(next);
    timer.current = setTimeout(settle, UNDO_MS);
  }

  function fail(id: string, message: string) {
    hide(id, false);
    setError(message);
  }

  function remove(item: ListItem) {
    hide(item.id, true);
    setError(null);
    offerUndo({
      message: `Deleted “${item.title || "Untitled backblast"}”`,
      undo: () => hide(item.id, false),
      finish: () =>
        deleteBackblast(item.id).then(
          () => onDeleted?.(item.id),
          (e: Error) => fail(item.id, e.message),
        ),
    });
  }

  function toggleArchive(item: ListItem, isArchived: boolean) {
    hide(item.id, true);
    setError(null);
    const name = item.title || "Untitled backblast";
    const [run, revert] = isArchived
      ? [unarchive, archive]
      : [archive, unarchive];
    run(item.id).then(
      () => {
        onArchived?.(item.id, !isArchived);
        offerUndo({
          message: `${isArchived ? "Unarchived" : "Archived"} “${name}”`,
          undo: () =>
            revert(item.id).then(
              () => {
                hide(item.id, false);
                onArchived?.(item.id, isArchived);
              },
              (e: Error) => setError(e.message),
            ),
        });
      },
      (e: Error) => fail(item.id, e.message),
    );
  }

  function option(
    action: SwipeAction,
    item: ListItem,
  ): SwipeOption | undefined {
    if (action === "delete")
      return item.author_id === user.id
        ? {
            label: "Delete",
            color: COLORS.delete,
            onCommit: () => remove(item),
          }
        : undefined;
    const isArchived =
      typeof archived === "function" ? archived(item) : archived;
    return {
      label: isArchived ? "Unarchive" : "Archive",
      color: COLORS.archive,
      onCommit: () => toggleArchive(item, isArchived),
    };
  }

  const swipeRight: SwipeAction =
    user.swipeLeft === "delete" ? "archive" : "delete";

  return (
    <>
      {groups.map((group, index) => {
        const items = group.items.filter((item) => !hidden.has(item.id));
        if (items.length === 0 && !group.empty) return null;
        return (
          <div
            key={group.title ?? index}
            className="panel flex flex-col gap-1 p-2"
          >
            {group.title && <h2 className="label px-3 pt-2">{group.title}</h2>}
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-muted">{group.empty}</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id}>
                    <SwipeRow
                      left={option(user.swipeLeft, item)}
                      right={option(swipeRight, item)}
                    >
                      <Row
                        item={item}
                        highlight={highlight}
                        snippet={snippets?.[item.id]}
                      />
                    </SwipeRow>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-accent">{error}</p>}
      {pending && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line-strong bg-surface-raised px-4 py-3 shadow-xl"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {pending.message}
          </span>
          <button
            type="button"
            onClick={() => {
              const { undo } = pending;
              if (timer.current) clearTimeout(timer.current);
              timer.current = null;
              current.current = null;
              setPending(null);
              undo();
            }}
            className="shrink-0 text-sm font-semibold text-accent"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}

function Row({
  item,
  highlight,
  snippet,
}: {
  item: ListItem;
  highlight: string[];
  snippet?: string;
}) {
  const draft = item.status === "draft";
  return (
    <Link
      href={
        draft ? `/backblasts/edit?id=${item.id}` : `/backblast?id=${item.id}`
      }
      draggable={false}
      className="group flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-hover"
    >
      <span
        className={
          draft
            ? "h-8 w-0.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]"
            : "h-8 w-0.5 shrink-0 rounded-full bg-line-strong transition-colors group-hover:bg-accent group-hover:shadow-[0_0_8px_var(--color-accent)]"
        }
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-ink">
          <Highlight
            text={item.title || "Untitled backblast"}
            words={highlight}
          />
        </span>
        <span className="truncate text-sm text-muted">
          {draft
            ? [item.ao, item.date].filter(Boolean).join(" · ") ||
              "Tap to keep writing"
            : [item.ao, item.author?.name].filter(Boolean).join(" · ")}
        </span>
        {snippet && (
          <span className="truncate text-xs text-muted">
            <Highlight text={snippet} words={highlight} />
          </span>
        )}
      </span>
      {draft ? (
        <span className="status">Draft</span>
      ) : (
        <span className="font-mono text-sm text-ink-soft">{item.date}</span>
      )}
    </Link>
  );
}
