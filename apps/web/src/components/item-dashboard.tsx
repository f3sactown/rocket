"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLists, type ItemKind, type ListItem } from "@/lib/backblast-list";
import type { CurrentUser } from "./auth-provider";
import { BackblastList } from "./backblast-list";
import { PlusIcon } from "./icons";

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
    loadLists(kind, user.id).then(setLists, (e: Error) => setError(e.message));
  }, [user.id, kind]);

  return (
    <section className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">{words.title}</h1>
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
    </section>
  );
}
