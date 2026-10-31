"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastForm } from "@/components/backblast-form";
import type { SectionTemplate } from "@/components/section-templates";
import { toInsert } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";

export default function NewBackblastPage() {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
      <SignedIn>{(user) => <NewBackblast user={user} />}</SignedIn>
    </>
  );
}

function NewBackblast({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<SectionTemplate[] | null>(null);

  useEffect(() => {
    createClient()
      .from("section_templates")
      .select("id, section, name, body")
      .order("name")
      .then(({ data }) => setTemplates(data ?? []));
  }, []);

  if (!templates) return <div className="card h-96 animate-pulse" />;

  return (
    <BackblastForm
      userId={user.id}
      defaultQ={user.name}
      initialTemplates={templates}
      onSave={async (backblast) => {
        const { data, error } = await createClient()
          .from("backblasts")
          .insert({ ...toInsert(backblast), author_id: user.id })
          .select("id")
          .single();
        if (error) return error.message;
        router.push(`/backblast?id=${data.id}`);
      }}
    />
  );
}
