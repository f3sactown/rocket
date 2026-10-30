import Link from "next/link";
import { Suspense } from "react";
import { createBackblast } from "@/app/actions";
import { BackblastForm } from "@/components/backblast-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default function NewBackblastPage() {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <NewBackblast />
      </Suspense>
    </>
  );
}

async function NewBackblast() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("section_templates")
    .select("id, section, name, body")
    .order("name");
  return (
    <BackblastForm
      action={createBackblast}
      userId={user.id}
      defaultQ={user.name}
      initialTemplates={templates ?? []}
    />
  );
}
