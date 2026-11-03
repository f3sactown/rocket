"use client";

import Link from "next/link";
import { loadPaxStats } from "@/lib/regions";
import { useLoad, useUserRegion } from "@/lib/use-region";
import type { CurrentUser } from "./auth-provider";

/** The blue the user card is outlined in, the app's Blue accent, whatever accent is chosen. */
const BADGE_BLUE = "#60a5fa";

/** The user's name and region, with their total posts and Qs below, in a blue outline. */
export function UserBadge({ user }: { user: CurrentUser }) {
  const region = useUserRegion();
  const stats = useLoad(region ? () => loadPaxStats(region, user.name) : null, [
    region?.id,
    user.name,
  ]);
  return (
    <div
      className="flex shrink-0 flex-col items-end gap-0.5 rounded-xl border px-3 py-2 text-right"
      style={{
        borderColor: BADGE_BLUE,
        boxShadow: `0 0 12px color-mix(in srgb, ${BADGE_BLUE} 30%, transparent)`,
      }}
    >
      <span className="text-sm text-ink">
        {user.name}
        {region && <span className="text-muted"> • {region.name}</span>}
      </span>
      {region === null ? (
        <Link href="/settings" className="text-xs text-muted hover:text-ink">
          Choose your region →
        </Link>
      ) : (
        <span className="text-xs text-ink-soft">
          {stats.value ? (
            <>
              <span className="font-mono text-ink">{stats.value.posts}</span>{" "}
              posts ·{" "}
              <span className="font-mono text-ink">{stats.value.qs}</span> Qs
            </>
          ) : stats.error ? (
            "Totals unavailable"
          ) : (
            "Loading…"
          )}
        </span>
      )}
    </div>
  );
}
