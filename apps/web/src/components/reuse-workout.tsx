"use client";

import type { WorkoutRun } from "@rocket/core";
import { useState } from "react";
import { loadSites, nextDateOn, sitesByDay } from "@/lib/regions";
import { useLoad, useUserRegion } from "@/lib/use-region";
import { PlusIcon } from "./icons";

/** The AO menu's choice for typing an AO that isn't listed. */
const OTHER_AO = "__other";

/**
 * Asks where and when a workout is run again, like the Basics page: the AO first (from the
 * region's list, by weekday), which fills in its location, time and next date, then the date and
 * time to change if needed.
 */
export function ReuseWorkout({
  onAdd,
  onCancel,
  taken,
}: {
  onAdd: (run: WorkoutRun) => Promise<void>;
  onCancel: () => void;
  /** Dates the workout already runs on. */
  taken: string[];
}) {
  const region = useUserRegion();
  const sites = useLoad(region ? () => loadSites(region) : null, [region?.id]);
  const [run, setRun] = useState<WorkoutRun>({ date: "", ao: "" });
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseAo(name: string) {
    const site = sites.value?.find((s) => s.name === name);
    setRun((current) => ({
      ...current,
      ao: name,
      address: site?.address || undefined,
      time: site?.time || current.time,
      date: (site?.day && nextDateOn(site.day, site.time)) || current.date,
    }));
  }

  async function add() {
    if (!run.ao.trim() || !run.date)
      return setError("Choose the AO and the date.");
    if (taken.includes(run.date))
      return setError("The workout already runs that day.");
    setBusy(true);
    setError(null);
    try {
      await onAdd({ ...run, ao: run.ao.trim() });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line-strong p-4">
      <h3 className="font-semibold text-ink">Run it again</h3>
      <label className="label flex flex-col gap-1.5">
        AO
        {sites.value?.length ? (
          <select
            value={typing ? OTHER_AO : run.ao}
            onChange={(e) => {
              if (e.target.value === OTHER_AO) {
                setTyping(true);
                setRun((current) => ({
                  ...current,
                  ao: "",
                  address: undefined,
                }));
              } else {
                setTyping(false);
                chooseAo(e.target.value);
              }
            }}
            className="input text-base"
          >
            <option value="">Choose an AO…</option>
            {sitesByDay(sites.value).map((group) => (
              <optgroup key={group.day} label={group.day}>
                {group.sites.map((site) => (
                  <option key={site.name} value={site.name}>
                    {site.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={OTHER_AO}>Other…</option>
          </select>
        ) : null}
        {(typing || !sites.value?.length) && (
          <input
            value={run.ao}
            onChange={(e) => setRun((c) => ({ ...c, ao: e.target.value }))}
            placeholder="AO name"
            className="input text-base"
          />
        )}
      </label>
      <label className="label flex flex-col gap-1.5">
        Date
        <input
          type="date"
          value={run.date}
          onChange={(e) => setRun((c) => ({ ...c, date: e.target.value }))}
          className="input text-base"
        />
      </label>
      <label className="label flex flex-col gap-1.5">
        Time
        <input
          value={run.time ?? ""}
          onChange={(e) => setRun((c) => ({ ...c, time: e.target.value }))}
          placeholder="5:15am-6:00am"
          className="input text-base"
        />
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={add}
          className="btn px-4 disabled:opacity-50"
        >
          <PlusIcon />
          {busy ? "Adding…" : "Add date"}
        </button>
        <button type="button" onClick={onCancel} className="link">
          Cancel
        </button>
      </div>
    </div>
  );
}
