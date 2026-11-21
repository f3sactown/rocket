"use client";

import type { Language } from "@rocket/core";
import Link from "next/link";
import { useConnection } from "@/lib/connection";

/** A profile's organization from what a query brings back: its region's, or its "all" choice. */
export function orgOf(
  author:
    | {
        region_scope?: string | null;
        region?: { language?: string | null } | null;
      }
    | null
    | undefined,
): Language | undefined {
  const org = author?.region?.language ?? author?.region_scope;
  return org === "fia" || org === "f3" ? org : undefined;
}

/** Columns to select on a profile join for `orgOf`. */
export const AUTHOR_ORG_COLUMNS =
  "region_scope, region:regions!profiles_region_id_fkey(language)";

/**
 * An author's name that opens their PAX profile (posts, Qs, their public workouts and
 * backblasts). Offline, profiles can't load, so it's just the name.
 */
export function AuthorLink({
  name,
  org,
  className = "",
  children,
}: {
  name: string;
  org: Language;
  className?: string;
  children?: React.ReactNode;
}) {
  const { offline } = useConnection();
  if (offline)
    return (
      <span className={className} title="Profiles need a connection">
        {children ?? name}
      </span>
    );
  return (
    <Link
      href={`/pax/profile?name=${encodeURIComponent(name)}&org=${org}`}
      title={`${name}'s profile`}
      className={`${className} transition hover:border-accent/60 hover:text-ink`}
    >
      {children ?? name} <span aria-hidden>→</span>
    </Link>
  );
}
