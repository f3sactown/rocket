"use client";

import type { Backblast } from "@rocket/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";
import { fromRow } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";

// A query parameter instead of /backblasts/[id]/edit, because a static site can't serve dynamic paths.
export default function EditDraftPage() {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <SignedIn>{(user) => <EditDraft user={user} />}</SignedIn>
      </Suspense>
    </>
  );
}

function EditDraft({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [draft, setDraft] = useState<Backblast | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    createClient()
      .from("backblasts")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        // Published backblasts aren't drafts any more; show them instead.
        if (data?.status === "published")
          router.replace(`/backblast?id=${data.id}`);
        else
          setDraft(data && data.author_id === user.id ? fromRow(data) : null);
      });
  }, [id, user.id, router]);

  if (id && draft === undefined)
    return <div className="card h-96 animate-pulse" />;
  if (!draft)
    return (
      <section className="card">
        <h1 className="card-title">Draft not found</h1>
      </section>
    );
  return <BackblastEditor key={id} user={user} draftId={id!} initial={draft} />;
}
