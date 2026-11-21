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
  "region_scope, region:regions!profiles_region_id_fkey(language, name)";

/** A profile's region for a byline: its region's name, or "All F3 regions"; none if neither. */
export function regionOf(
  author:
    | {
        region_scope?: string | null;
        region?: { name?: string | null } | null;
      }
    | null
    | undefined,
): string | null {
  if (author?.region?.name) return author.region.name;
  if (author?.region_scope === "fia") return "All FiA regions";
  if (author?.region_scope === "f3") return "All F3 regions";
  return null;
}

/**
 * The byline under a workout's or backblast's title: "by Tinman · F3 SacTown", the name opening
 * their profile.
 */
export function Byline({
  prefix = "by",
  name,
  org,
  region,
}: {
  prefix?: string;
  name: string;
  org: Language;
  region?: string | null;
}) {
  return (
    <p className="-mt-2 text-sm text-ink-soft">
      {prefix}{" "}
      <AuthorLink
        name={name}
        org={org}
        className="font-medium text-ink underline decoration-accent/70 decoration-2 underline-offset-4 hover:decoration-accent"
      />
      {region && <span className="text-muted"> · {region}</span>}
    </p>
  );
}

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
      className={className}
    >
      {children ?? name}
    </Link>
  );
}
