"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { PlusIcon } from "@/components/icons";
import { BackblastList } from "@/components/backblast-list";
import { SignOutButton } from "@/components/sign-out-button";
import {
  LIST_COLUMNS,
  loadArchivedIds,
  type ListItem,
} from "@/lib/backblast-list";
import { loadPaxStats } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad, useUserRegion } from "@/lib/use-region";

export default function Home() {
  return <SignedIn>{(user) => <Dashboard user={user} />}</SignedIn>;
}

function Dashboard({ user }: { user: CurrentUser }) {
  const [lists, setLists] = useState<{
    drafts: ListItem[];
    published: ListItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // Archived backblasts are left out; they're on the Archive page.
      const archived = await loadArchivedIds();
      const notArchived = `(${archived.join(",")})`;
      let drafts = supabase
        .from("backblasts")
        .select(LIST_COLUMNS)
        .eq("status", "draft")
        .eq("author_id", user.id)
        .order("updated_at", { ascending: false });
      let published = supabase
        .from("backblasts")
        .select(LIST_COLUMNS)
        .eq("status", "published")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (archived.length) {
        drafts = drafts.not("id", "in", notArchived);
        published = published.not("id", "in", notArchived);
      }
      const [d, p] = await Promise.all([drafts, published]);
      if (d.error || p.error) throw new Error((d.error ?? p.error)!.message);
      setLists({
        drafts: d.data as unknown as ListItem[],
        published: p.data as unknown as ListItem[],
      });
    })().catch((e: Error) => setError(e.message));
  }, [user.id]);

  return (
    <section className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">Backblasts</h1>
        <span className="status mt-2 shrink-0">{user.name}</span>
      </header>
      <PaxTotals user={user} />

      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">{error}</p>
      ) : !lists ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : (
        <BackblastList
          user={user}
          groups={[
            { title: "Your drafts", items: lists.drafts },
            { items: lists.published, empty: "No backblasts yet." },
          ]}
        />
      )}

      <Link href="/backblasts/new" className="btn w-full">
        <PlusIcon />
        New backblast
      </Link>
      <div className="-mt-2 flex justify-center">
        <SignOutButton />
      </div>
    </section>
  );
}

/** The user's total posts and Qs from their region's sheet, or a nudge to choose a region. */
function PaxTotals({ user }: { user: CurrentUser }) {
  const region = useUserRegion();
  const stats = useLoad(region ? () => loadPaxStats(region, user.name) : null, [
    region?.id,
    user.name,
  ]);
  if (region === null)
    return (
      <Link href="/settings" className="link -mt-3">
        Choose your region in Settings to see your posts and Qs →
      </Link>
    );
  if (!stats.value) return null;
  return (
    <p className="-mt-3 text-sm text-ink-soft">
      <span className="font-mono text-ink">{stats.value.posts}</span> posts ·{" "}
      <span className="font-mono text-ink">{stats.value.qs}</span> Qs
      <span className="text-muted"> in {region?.name}</span>
    </p>
  );
}
