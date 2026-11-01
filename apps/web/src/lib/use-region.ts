"use client";

import { useEffect, useState } from "react";
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
