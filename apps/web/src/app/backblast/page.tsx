"use client";

import { formatBackblast, paxCount, type Backblast } from "@rocket/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { CopyButton } from "@/components/copy-button";
import { PencilIcon } from "@/components/icons";
import { fromRow } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";

// A query parameter instead of /backblasts/[id], because a static site can't serve dynamic paths.
export default function BackblastPage() {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <SignedIn>{(user) => <BackblastDetail user={user} />}</SignedIn>
      </Suspense>
    </>
  );
}

function BackblastDetail({ user }: { user: CurrentUser }) {
  const id = useSearchParams().get("id");
  const [result, setResult] = useState<{
    backblast: Backblast | null;
    authorId?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    createClient()
      .from("backblasts")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) =>
        setResult({
          backblast: data && fromRow(data),
          authorId: data?.author_id,
          error: error?.message,
        }),
      );
  }, [id]);

  if (id && !result) return <div className="card h-96 animate-pulse" />;
  if (!result?.backblast)
    return (
      <section className="card">
        <h1 className="card-title">Backblast not found</h1>
        {result?.error && <p className="text-accent">{result.error}</p>}
      </section>
    );

  const { backblast } = result;
  const text = formatBackblast(backblast);
  const count = (kind: string) =>
    backblast.attendees.filter((a) => a.kind === kind).length;
  const stats = [
    { label: "Count-o-rama", value: paxCount(backblast) },
    { label: "FNGs", value: count("fng") },
    { label: "Visitors", value: count("visitor") },
  ];

  return (
    <article className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">{backblast.title}</h1>
        <span className="status mt-2 shrink-0">{backblast.ao}</span>
      </header>

      <div className="panel grid grid-cols-3 divide-x divide-line p-0">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-2 py-5"
          >
            <span className="font-mono text-2xl text-ink">{stat.value}</span>
            <span className="text-sm text-ink-soft">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">Q: {backblast.q}</span>
        <span className="font-mono text-ink-soft">{backblast.date}</span>
      </div>

      <pre className="panel overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
        {text}
      </pre>

      <CopyButton text={text} />
      {result.authorId === user.id && (
        <Link href={`/backblasts/edit?id=${id}`} className="btn -mt-2 w-full">
          <PencilIcon />
          Edit backblast
        </Link>
      )}
    </article>
  );
}
