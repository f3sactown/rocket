"use client";

import { useSyncExternalStore } from "react";
import { supabaseUrl } from "./supabase/env";

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
  /** How many times the connection has come back, so screens can load their data again. */
  reconnects: number;
}

/** How often to look for the connection coming back, while offline. */
const PING_MS = 5000;
/** The longest a waiting request counts, in case its answer never comes. */
const PENDING_MS = 15000;

const ONLINE: Connection = { offline: false, checking: false, reconnects: 0 };
let snapshot: Connection = ONLINE;
let workerOffline = false;
const pending = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let started = false;
let ping: ReturnType<typeof setInterval> | null = null;

function update() {
  const offline = !navigator.onLine || workerOffline;
  const next: Connection = {
    offline,
    checking: pending.size > 0,
    // Back online: screens load their data again (fresh, not the copies kept on the phone).
    reconnects: snapshot.reconnects + (snapshot.offline && !offline ? 1 : 0),
  };
  if (
    next.offline === snapshot.offline &&
    next.checking === snapshot.checking &&
    next.reconnects === snapshot.reconnects
  )
    return;
  snapshot = next;
  // The accent turns grey while offline (globals.css).
  document.documentElement.dataset.connection = next.offline
    ? "offline"
    : "online";
  // While offline, look now and then for the connection coming back.
  if (next.offline && !ping) {
    ping = setInterval(lookForConnection, PING_MS);
    // Straight away too: a request that was only slow shouldn't leave it saying Offline.
    lookForConnection();
  }
  if (!next.offline && ping) {
    clearInterval(ping);
    ping = null;
  }
  for (const listener of listeners) listener();
}

/**
 * Looks for the connection: asks Supabase's server directly (not through the service worker, so
 * nothing kept can answer), and any answer at all means it's back. Then the service worker hears
 * so too, and stops answering from its kept copies.
 */
function lookForConnection() {
  fetch(`${supabaseUrl}/auth/v1/health?ping=${Date.now()}`, {
    mode: "no-cors",
    cache: "no-store",
  }).then(
    async () => {
      // The service worker first, so what loads next comes fresh rather than from its kept copies.
      await tellWorkerOnline();
      if (!workerOffline) return;
      workerOffline = false;
      update();
    },
    () => {},
  );
}

/** Tells the service worker the connection is back, and waits (briefly) for it to take that in. */
function tellWorkerOnline(): Promise<void> {
  const worker = navigator.serviceWorker?.controller;
  if (!worker) return Promise.resolve();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    setTimeout(resolve, 1000);
    worker.postMessage({ type: "rocket-online" }, [channel.port2]);
  });
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
    // The phone says it's back: still Offline until the server answers (and the service worker
    // knows), so screens that load again get fresh data.
    workerOffline = true;
    update();
    lookForConnection();
  });
  window.addEventListener("offline", update);
  // Back to Rocket from another app (timers pause meanwhile): look again if it said Offline.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && snapshot.offline)
      lookForConnection();
  });
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

/**
 * Whether Rocket is offline right now (the phone says so, or a request just had to use a kept
 * copy), for code outside React: loaders go straight to what's kept on the phone.
 */
export function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  start();
  return !navigator.onLine || workerOffline;
}

/** The connection, kept up to date. */
export function useConnection(): Connection {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => ONLINE,
  );
}
