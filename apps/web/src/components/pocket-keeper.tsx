"use client";

import { useEffect } from "react";
import { useConnection } from "@/lib/connection";
import { POCKET_EVERY_MS, refreshPocket, setPocketOwner } from "@/lib/pocket";
import { useAuth } from "./auth-provider";

/**
 * Keeps your recent workouts and backblasts (and the Exicon) on this phone, fetched again on
 * opening Rocket, on reconnecting and every 10 minutes (see lib/pocket.ts).
 */
export function PocketKeeper() {
  const { user } = useAuth();
  const { offline, reconnects } = useConnection();
  const userId = user && !user.needsProfile ? user.id : null;
  useEffect(() => {
    setPocketOwner(userId);
  }, [userId]);
  useEffect(() => {
    // Not in the hidden frames that keep copies of screens.
    if (!userId || offline || window.top !== window) return;
    void refreshPocket(userId);
    const timer = setInterval(
      () => void refreshPocket(userId),
      POCKET_EVERY_MS,
    );
    return () => clearInterval(timer);
  }, [userId, offline, reconnects]);
  return null;
}
