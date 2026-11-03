"use client";

import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastList } from "@/components/backblast-list";
import {
  asItems,
  listColumns,
  loadArchivedIds,
  tableFor,
  type ItemKind,
  type ListItem,
} from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";

export default function ArchivePage() {
  return <SignedIn>{(user) => <Archive user={user} />}</SignedIn>;
}

/** What the user archived of one kind, most recently archived first. */
async function loadArchived(kind: ItemKind): Promise<ListItem[]> {
  const ids = await loadArchivedIds(kind);
  if (ids.length === 0) return [];
  const { data, error } = await createClient()
    .from(tableFor(kind))
    .select(listColumns(kind))
    .in("id", ids);
  if (error) throw new Error(error.message);
  const rows = asItems(kind, data);
  return ids.flatMap((id) => rows.find((row) => row.id === id) ?? []);
}

/** Everything the user archived: workouts, then backblasts. */
function Archive({ user }: { user: CurrentUser }) {
  const [items, setItems] = useState<{
    workouts: ListItem[];
    backblasts: ListItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadArchived("workout"), loadArchived("backblast")]).then(
      ([workouts, backblasts]) => setItems({ workouts, backblasts }),
      (e: Error) => setError(e.message),
    );
  }, [user.id]);

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Archive</h1>
        <p className="text-sm text-muted">
          Workouts and backblasts you&apos;ve archived. Only you see them as
          archived; swipe one to put it back.
        </p>
      </header>
      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">{error}</p>
      ) : !items ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : items.workouts.length + items.backblasts.length === 0 ? (
        <p className="panel px-3 py-8 text-center text-muted">
          Nothing archived.
        </p>
      ) : (
        <BackblastList
          user={user}
          archived
          groups={[
            { title: "Workouts", items: items.workouts },
            { title: "Backblasts", items: items.backblasts },
          ]}
        />
      )}
    </section>
  );
}
