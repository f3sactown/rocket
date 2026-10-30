import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { PlusIcon } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Dashboard />
    </Suspense>
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
    <section className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">Backblasts</h1>
        <span className="status mt-2">{user.name}</span>
      </header>

      <div className="panel p-2">
        {backblasts.length === 0 ? (
          <p className="px-3 py-8 text-center text-muted">No backblasts yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {backblasts.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/backblasts/${b.id}`}
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
