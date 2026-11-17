"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConnection } from "@/lib/connection";

/** Screens that need a connection: they search or browse everyone's data, which isn't kept. */
export const ONLINE_ONLY = [
  "/discover",
  "/library",
  "/archive",
  "/search",
  "/pax",
];

/** Whether a path is one of the screens that need a connection. */
export function needsConnection(path: string): boolean {
  const page = path.replace(/\/$/, "") || "/";
  return ONLINE_ONLY.some((p) => page === p || page.startsWith(`${p}/`));
}

/** Offline, a screen that needs a connection says so instead of failing to load. */
export function OfflineGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { offline } = useConnection();
  if (!offline || !needsConnection(pathname)) return children;
  return (
    <section className="card">
      <h1 className="card-title">Needs a connection</h1>
      <p className="text-ink-soft">
        This screen searches and browses everyone&apos;s workouts, exercises and
        PAX, so it isn&apos;t kept on this phone. It&apos;s back as soon as
        you&apos;re online. Your own workouts and backblasts, and running them,
        work offline.
      </p>
      <Link href="/" className="btn self-start">
        Home
      </Link>
    </section>
  );
}
