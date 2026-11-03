"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  asItems,
  listColumns,
  loadArchivedIds,
  tableFor,
  type ItemKind,
  type ListItem,
} from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { BackblastList } from "./backblast-list";
import { PlusIcon } from "./icons";
import { SignOutButton } from "./sign-out-button";
import { UserBadge } from "./user-badge";

const WORDS = {
  workout: {
    title: "Workouts",
    empty: "No workouts yet.",
    newHref: "/workouts/new",
    newLabel: "New workout",
  },
  backblast: {
    title: "Backblasts",
    empty: "No backblasts yet.",
    newHref: "/backblasts/new",
    newLabel: "New backblast",
  },
};

/**
 * A list page for workouts or backblasts: your drafts, then everyone's finished ones, newest
 * first, leaving out what you've archived.
 */
export function ItemDashboard({
  user,
  kind,
}: {
  user: CurrentUser;
  kind: ItemKind;
}) {
  const words = WORDS[kind];
  const [lists, setLists] = useState<{
    drafts: ListItem[];
    published: ListItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // Archived ones are left out; they're on the Archive page.
      const archived = await loadArchivedIds(kind);
      const notArchived = `(${archived.join(",")})`;
      let drafts = supabase
        .from(tableFor(kind))
        .select(listColumns(kind))
        .eq("status", "draft")
        .eq("author_id", user.id)
        .order("updated_at", { ascending: false });
      let published = supabase
        .from(tableFor(kind))
        .select(listColumns(kind))
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
        drafts: asItems(kind, d.data),
        published: asItems(kind, p.data),
      });
    })().catch((e: Error) => setError(e.message));
  }, [user.id, kind]);

  return (
    <section className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">{words.title}</h1>
        <UserBadge user={user} />
      </header>

      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">{error}</p>
      ) : !lists ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : (
        <BackblastList
          user={user}
          groups={[
            { title: "Your drafts", items: lists.drafts },
            { items: lists.published, empty: words.empty },
          ]}
        />
      )}

      <Link href={words.newHref} className="btn w-full">
        <PlusIcon />
        {words.newLabel}
      </Link>
      <div className="-mt-2 flex justify-center">
        <SignOutButton />
      </div>
    </section>
  );
}
