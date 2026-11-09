"use client";

import { formatDate } from "@rocket/core";
import { ArrowIcon } from "./icons";

/**
 * Create backblast, unavailable because the workout hasn't happened yet, with the reason: a
 * backblast can be written on the workout's day or after.
 */
export function BackblastNotYet({ date }: { date: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" disabled className="btn w-full opacity-50">
        <ArrowIcon />
        Create backblast
      </button>
      <p className="text-center text-sm text-muted">
        This workout is on {formatDate(date)}. You can write its backblast on
        that day or after, once it has happened.
      </p>
    </div>
  );
}
