"use client";

import { useSyncExternalStore } from "react";

/**
 * How the connection is doing, for the Offline banner and "Checking connection…". The phone's own
 * online flag only changes once it gives up on its network, which can take a long while with a
 * weak or dead signal; Rocket's service worker says sooner, as soon as a request has to use a kept
 * copy (and when one is still waiting).
 */
export interface Connection {
  /** Offline: the phone says so, or a request just had to use a kept copy. */
  offline: boolean;
  /** A request has been waiting a while; it may be about to use a kept copy. */
  checking: boolean;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** How often to look for the connection coming back, while offline. */
const PING_MS = 10000;
/** The longest a waiting request counts, in case its answer never comes. */
const PENDING_MS = 15000;

const ONLINE: Connection = { offline: false, checking: false };
let snapshot: Connection = ONLINE;
let workerOffline = false;
const pending = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let started = false;
let ping: ReturnType<typeof setInterval> | null = null;

function update() {
  const next: Connection = {
    offline: !navigator.onLine || workerOffline,
    checking: pending.size > 0,
  };
  if (next.offline === snapshot.offline && next.checking === snapshot.checking)
    return;
  snapshot = next;
  // While offline, look now and then for the connection coming back (through the service
  // worker, which says so when a request gets through).
  if (next.offline && !ping) ping = setInterval(lookForConnection, PING_MS);
  if (!next.offline && ping) {
    clearInterval(ping);
    ping = null;
  }
  for (const listener of listeners) listener();
}

function lookForConnection() {
  fetch(`${BASE}/manifest.webmanifest?ping=${Date.now()}`, {
    cache: "no-store",
  }).catch(() => {});
}

function onMessage(event: MessageEvent) {
  const data = event.data as { type?: string; state?: string; id?: number };
  if (data?.type !== "rocket-connection") return;
  if (data.state === "offline") workerOffline = true;
  if (data.state === "online") workerOffline = false;
  if (data.state === "checking" && data.id !== undefined) {
    const id = data.id;
    pending.set(
      id,
      setTimeout(() => {
        pending.delete(id);
        update();
      }, PENDING_MS),
    );
  }
  if (data.state === "settled" && data.id !== undefined) {
    clearTimeout(pending.get(data.id));
    pending.delete(data.id);
  }
  update();
}

function start() {
  if (started) return;
  started = true;
  window.addEventListener("online", () => {
    update();
    // The phone says it's back: check, so the banner goes as soon as a request gets through.
    lookForConnection();
  });
  window.addEventListener("offline", update);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", onMessage);
    // What the service worker already knows (e.g. offline when this page opened).
    navigator.serviceWorker.controller?.postMessage({
      type: "rocket-connection?",
    });
  }
  update();
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The connection, kept up to date. */
export function useConnection(): Connection {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => ONLINE,
  );
}
