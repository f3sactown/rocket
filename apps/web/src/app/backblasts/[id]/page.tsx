import { formatBackblast } from "@rocket/core";
import { backblast } from "@rocket/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function BackblastPage({
  params,
}: PageProps<"/backblasts/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/" className="text-sm underline">
        ← All backblasts
      </Link>
      <Suspense fallback={<p>Loading…</p>}>
        <BackblastDetail params={params} />
      </Suspense>
    </main>
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

  const [row] = await db.select().from(backblast).where(eq(backblast.id, id));
  if (!row) notFound();

  const text = formatBackblast({
    ...row,
    warmup: row.warmup ?? undefined,
    thang: row.thang ?? undefined,
    moleskin: row.moleskin ?? undefined,
  });

  return (
    <>
      <pre className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-900">
        {text}
      </pre>
      <CopyButton text={text} />
    </>
  );
}
