import { formatBackblast, paxCount } from "@rocket/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function BackblastPage({
  params,
}: PageProps<"/backblasts/[id]">) {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <BackblastDetail params={params} />
      </Suspense>
    </>
  );
}

async function BackblastDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("backblasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const backblast = {
    ...row,
    warmup: row.warmup ?? undefined,
    thang: row.thang ?? undefined,
    moleskin: row.moleskin ?? undefined,
  };
  const text = formatBackblast(backblast);
  const stats = [
    { label: "Head count", value: paxCount(backblast) },
    { label: "PAX", value: row.pax.length },
    { label: "FNGs", value: row.fngs.length },
  ];

  return (
    <article className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">{row.title}</h1>
        <span className="status mt-2 shrink-0">{row.ao}</span>
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
        <span className="font-medium text-ink">Q: {row.q}</span>
        <span className="font-mono text-ink-soft">{row.date}</span>
      </div>

      <pre className="panel overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
        {text}
      </pre>

      <CopyButton text={text} />
    </article>
  );
}
