"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { PlusIcon } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/client";

interface ListItem {
  id: string;
  title: string;
  date: string | null;
  ao: string;
  author: { name: string } | null;
}

interface Draft {
  id: string;
  title: string;
  date: string | null;
  ao: string;
}

export default function Home() {
  return <SignedIn>{(user) => <Dashboard user={user} />}</SignedIn>;
}

function Dashboard({ user }: { user: CurrentUser }) {
  const [backblasts, setBackblasts] = useState<ListItem[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("backblasts")
      .select("id, title, date, ao")
      .eq("status", "draft")
      .eq("author_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setDrafts(data ?? []));
    supabase
      .from("backblasts")
      .select("id, title, date, ao, author:profiles(name)")
      .eq("status", "published")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setBackblasts(data);
      });
  }, [user.id]);

  return (
    <section className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">Backblasts</h1>
        <span className="status mt-2">{user.name}</span>
      </header>

      {drafts.length > 0 && (
        <div className="panel flex flex-col gap-1 p-2">
          <h2 className="label px-3 pt-2">Your drafts</h2>
          <ul className="divide-y divide-line">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/backblasts/edit?id=${d.id}`}
                  className="group flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-white/[0.02]"
                >
                  <span className="h-8 w-0.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-ink">
                      {d.title || "Untitled backblast"}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {[d.ao, d.date].filter(Boolean).join(" · ") ||
                        "Tap to keep writing"}
                    </span>
                  </span>
                  <span className="status">Draft</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel p-2">
        {error ? (
          <p className="px-3 py-8 text-center text-accent">{error}</p>
        ) : !backblasts ? (
          <p className="px-3 py-8 text-center text-muted">Loading…</p>
        ) : backblasts.length === 0 ? (
          <p className="px-3 py-8 text-center text-muted">No backblasts yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {backblasts.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/backblast?id=${b.id}`}
                  className="group flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-white/[0.02]"
                >
                  <span className="h-8 w-0.5 rounded-full bg-line-strong transition-colors group-hover:bg-accent group-hover:shadow-[0_0_8px_var(--color-accent)]" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-ink">
                      {b.title}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {b.ao} · {b.author?.name}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-ink-soft">
                    {b.date}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

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
