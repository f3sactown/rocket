"use client";

import { useSyncExternalStore } from "react";

/**
 * Workouts and backblasts swiped to delete, waiting out Undo: hidden from every list at once
 * (Home's Today's, Future and Recent, the Workouts and Backblasts pages), and back if Undo is
 * tapped. Once the delete's done, the lists load again without them.
 */
let deleting: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function change(next: Set<string>) {
  deleting = next;
  for (const listener of listeners) listener();
}

/** Hides one everywhere while its delete waits for Undo. */
export function markDeleting(id: string) {
  change(new Set([...deleting, id]));
}

/** Shows it again (Undo, or the delete failed). */
export function unmarkDeleting(id: string) {
  const next = new Set(deleting);
  next.delete(id);
  change(next);
}

/** The IDs being deleted, kept up to date. */
export function useDeleting(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => deleting,
    () => deleting,
  );
}
