import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { SignOutButton } from "@/components/sign-out-button";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <h1 className="text-3xl font-bold">🚀 Rocket</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await getUser();
  if (!user) return <AuthForm />;

  const supabase = await createClient();
  const { data: backblasts, error } = await supabase
    .from("backblasts")
    .select("id, title, date, ao, author:profiles(name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  return (
    <>
      <div className="flex items-center justify-between">
        <p>
          Welcome, <strong>{user.name}</strong>
        </p>
        <SignOutButton />
      </div>
      <Link href="/backblasts/new" className="btn self-start">
        New backblast
      </Link>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Recent backblasts</h2>
        {backblasts.length === 0 && (
          <p className="text-zinc-500">No backblasts yet.</p>
        )}
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {backblasts.map((b) => (
            <li key={b.id} className="py-2">
              <Link
                href={`/backblasts/${b.id}`}
                className="font-medium underline"
              >
                {b.title}
              </Link>
              <span className="text-sm text-zinc-500">
                {" "}
                · {b.date} · {b.ao} · by {b.author?.name}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
