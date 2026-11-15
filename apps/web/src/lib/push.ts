"use client";

import { createClient } from "./supabase/client";

/** The Edge Function that holds the push keys and sends notifications. */
const FUNCTION = "push-reminders";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** What this device can do about push notifications. */
export type PushSupport =
  | "supported"
  /** An iPhone or iPad with Rocket open in a Safari tab, not added to the Home Screen. */
  | "needs-home-screen"
  | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
    return "supported";
  // iOS only offers push to sites added to the Home Screen and opened from there.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "needs-home-screen" : "unsupported";
}

/** Rocket's service worker, registered once (it only shows notifications). */
function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(`${BASE}/sw.js`, {
    scope: `${BASE}/`,
  });
}

/** This device's push subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const existing = await navigator.serviceWorker.getRegistration(`${BASE}/`);
  return (await existing?.pushManager.getSubscription()) ?? null;
}

/** A base64url key as the bytes PushManager wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Turns notifications on for this device: asks the browser's permission, signs the device up
 * with its push service, and saves that to the account. Returns an error message, or null.
 */
export async function enablePush(): Promise<string | null> {
  if (pushSupport() !== "supported")
    return "This browser can't show notifications.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return "Notifications are blocked for Rocket. Allow them in this browser's site settings, then try again.";
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke<{
    publicKey: string | null;
  }>(FUNCTION, { body: { action: "key" } });
  if (error || !data?.publicKey)
    return "Notifications aren't set up on Rocket's server yet.";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  // A subscription made with an older key can't be used; start over.
  const key = subscription?.options.applicationServerKey;
  if (
    subscription &&
    key &&
    btoa(String.fromCharCode(...new Uint8Array(key)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "") !== data.publicKey
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(data.publicKey),
  });
  const json = subscription.toJSON();
  const { error: saveError } = await supabase.rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  return saveError?.message ?? null;
}

/** Turns notifications off for this device. */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await createClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

/** Sends a test notification to every device of the signed-in user. */
export async function sendTestPush(): Promise<string | null> {
  const { data, error } = await createClient().functions.invoke<{
    sent?: number;
    error?: string;
  }>(FUNCTION, { body: { action: "test" } });
  if (error) return error.message;
  if (data?.error) return data.error;
  return data?.sent
    ? null
    : "No device received it. Turn notifications on again.";
}
