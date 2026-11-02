"use client";

import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastList } from "@/components/backblast-list";
import {
  LIST_COLUMNS,
  loadArchivedIds,
  type ListItem,
} from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";

export default function ArchivePage() {
  return <SignedIn>{(user) => <Archive user={user} />}</SignedIn>;
}

/** Everything the user archived, most recently archived first. */
function Archive({ user }: { user: CurrentUser }) {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ids = await loadArchivedIds();
      if (ids.length === 0) return setItems([]);
      const { data, error } = await createClient()
        .from("backblasts")
        .select(LIST_COLUMNS)
        .in("id", ids);
      if (error) throw new Error(error.message);
      const rows = data as unknown as ListItem[];
      setItems(ids.flatMap((id) => rows.find((row) => row.id === id) ?? []));
    })().catch((e: Error) => setError(e.message));
  }, [user.id]);

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Archive</h1>
        <p className="text-sm text-muted">
          Backblasts you&apos;ve archived. Only you see them as archived; swipe
          one to put it back.
        </p>
      </header>
      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">{error}</p>
      ) : !items ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : (
        <BackblastList
          user={user}
          archived
          groups={[{ items, empty: "Nothing archived." }]}
        />
      )}
    </section>
  );
}
