import Link from "next/link";
import { Suspense } from "react";
import { createBackblast } from "@/app/actions";
import { BackblastForm } from "@/components/backblast-form";
import { requireUser } from "@/lib/auth";

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
  return <BackblastForm action={createBackblast} defaultQ={user.name} />;
}
