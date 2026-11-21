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

/**
 * Under a workout's or backblast's title, in two columns: on the left who wrote it ("by Tinman",
 * the name opening their profile) with their region below (and anything else, e.g. "Originally
 * by …"); on the right the AO, with the date below.
 */
export function TitleMeta({
  author,
  ao,
  date,
  children,
}: {
  author: { name: string; org: Language; region?: string | null } | null;
  ao: string;
  date: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="-mt-2 flex items-start justify-between gap-4 text-sm">
      <div className="flex min-w-0 flex-col gap-0.5">
        {author && (
          <span className="text-ink-soft">
            by{" "}
            <AuthorLink
              name={author.name}
              org={author.org}
              className="font-medium text-ink underline decoration-accent/70 decoration-2 underline-offset-4 hover:decoration-accent"
            />
          </span>
        )}
        {author?.region && <span className="text-muted">{author.region}</span>}
        {children}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {ao.trim() && <span className="font-medium text-ink">{ao}</span>}
        {date && <span className="text-ink-soft">{date}</span>}
      </div>
    </div>
  );
}
