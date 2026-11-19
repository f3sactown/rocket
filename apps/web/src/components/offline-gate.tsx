"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { useConnection } from "@/lib/connection";

/**
 * Screens that need a connection: they search or browse everyone's data, which isn't kept. (The
 * Exicon is kept on the phone, so it works offline.)
 */
export const ONLINE_ONLY = [
  "/discover",
  "/archive",
  "/search",
  "/pax",
  "/workouts/generate",
  // Changes to your account need a connection to be saved.
  "/settings",
];

/** Screens that aren't started over when the connection's back: forms and running a workout. */
const KEEPS_STATE = [
  "/workouts/new",
  "/workouts/edit",
  "/backblasts/new",
  "/backblasts/edit",
  "/workout/run",
];

function keepsState(path: string): boolean {
  const page = path.replace(/\/$/, "") || "/";
  return KEEPS_STATE.includes(page);
}

/** Whether a path is one of the screens that need a connection. */
export function needsConnection(path: string): boolean {
  const page = path.replace(/\/$/, "") || "/";
  return ONLINE_ONLY.some((p) => page === p || page.startsWith(`${p}/`));
}

/** Offline, a screen that needs a connection says so instead of failing to load. */
export function OfflineGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { offline, reconnects } = useConnection();
  if (!offline || !needsConnection(pathname))
    // Back online, the screen starts over to load its data fresh, except where you're typing
    // or running a workout (nothing's lost there, and it saves once it can).
    return (
      <Fragment key={keepsState(pathname) ? 0 : reconnects}>
        {children}
      </Fragment>
    );
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
