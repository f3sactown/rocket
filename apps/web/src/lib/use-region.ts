"use client";

import { useEffect, useState } from "react";
import { termsFor, type Language } from "@rocket/core";
import { useAuth } from "@/components/auth-provider";
import { loadRegions, type Region } from "./regions";

/** The result of an async load: the value once it arrives, or the error. */
export interface Loaded<T> {
  value?: T;
  error?: string;
  loading: boolean;
}

/**
 * Runs `load` when `deps` change and tracks the result. Pass `null` for `load` when there's
 * nothing to load yet (e.g. no region chosen).
 */
export function useLoad<T>(
  load: (() => Promise<T>) | null,
  deps: unknown[],
): Loaded<T> {
  const [state, setState] = useState<{ key: string; result: Loaded<T> }>({
    key: "",
    result: { loading: false },
  });
  const key = JSON.stringify(deps);
  const enabled = load !== null;

  useEffect(() => {
    if (!load) return;
    let current = true;
    load().then(
      (value) =>
        current && setState({ key, result: { value, loading: false } }),
      (error: Error) =>
        current &&
        setState({ key, result: { error: error.message, loading: false } }),
    );
    return () => {
      current = false;
    };
    // `load` is recreated each render; the inputs it reads are listed in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  if (!enabled) return { loading: false };
  return state.key === key ? state.result : { loading: true };
}

/** The signed-in user's home region, once loaded (undefined while loading, null if none). */
export function useUserRegion(): Region | null | undefined {
  const regionId = useAuth().user?.regionId ?? null;
  const regions = useLoad(() => loadRegions(), []);
  if (!regionId) return null;
  if (!regions.value) return regions.error ? null : undefined;
  return regions.value.find((r) => r.id === regionId) ?? null;
}

/**
 * The region choice for every F3 region or every FiA region, stored as the account's region for
 * PAX who post across several regions of one organization.
 */
export const ALL_REGIONS: Record<Language, string> = {
  f3: "all:f3",
  fia: "all:fia",
};

/** The organization an "all regions" choice covers, or null for a single region (or none). */
export function allRegionsLanguage(
  regionId: string | null | undefined,
): Language | null {
  if (regionId === ALL_REGIONS.f3) return "f3";
  if (regionId === ALL_REGIONS.fia) return "fia";
  return null;
}

/** The regions the user's choice covers: one region, or every region of one organization. */
export interface RegionScope {
  regions: Region[];
  /** Set when the choice is every region of one organization. */
  all: Language | null;
  /** "F3 SacTown", or "All F3 regions". */
  label: string;
}

/** The user's region scope, once loaded (undefined while loading, null if they have none). */
export function useRegionScope(): RegionScope | null | undefined {
  const regionId = useAuth().user?.regionId ?? null;
  const regions = useLoad(() => loadRegions(), []);
  if (!regionId) return null;
  if (!regions.value) return regions.error ? null : undefined;
  const all = allRegionsLanguage(regionId);
  if (all)
    return {
      regions: regions.value.filter((r) => r.language === all),
      all,
      label: `All ${termsFor(all).org} regions`,
    };
  const region = regions.value.find((r) => r.id === regionId);
  return region ? { regions: [region], all: null, label: region.name } : null;
}
