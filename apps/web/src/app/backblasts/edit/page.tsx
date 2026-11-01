"use client";

import type { Backblast } from "@rocket/core";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";
import { fromRow } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";

// A query parameter instead of /backblasts/[id]/edit, because a static site can't serve dynamic paths.
export default function EditBackblastPage() {
  return (
    <>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <SignedIn>{(user) => <EditBackblast user={user} />}</SignedIn>
      </Suspense>
    </>
  );
}

function EditBackblast({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [loaded, setLoaded] = useState<
    { backblast: Backblast; published: boolean } | null | undefined
  >(undefined);

  useEffect(() => {
    if (!id) return;
    createClient()
      .from("backblasts")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        // Only the author can edit; anyone else is shown the published backblast instead.
        if (data && data.author_id !== user.id && data.status === "published")
          router.replace(`/backblast?id=${data.id}`);
        else
          setLoaded(
            data && data.author_id === user.id
              ? {
                  backblast: fromRow(data),
                  published: data.status === "published",
                }
              : null,
          );
      });
  }, [id, user.id, router]);

  if (id && loaded === undefined)
    return <div className="card h-96 animate-pulse" />;
  if (!loaded)
    return (
      <section className="card">
        <h1 className="card-title">Backblast not found</h1>
      </section>
    );
  return (
    <BackblastEditor
      key={id}
      user={user}
      draftId={id!}
      published={loaded.published}
      initial={loaded.backblast}
    />
  );
}
