"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "./icons";

/** The Google OAuth client's ID; without it, sign-in goes through Supabase's redirect instead. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Where the nonce and state wait in this tab while Google's sign-in page is open. */
const PENDING_KEY = "rocket.google-sign-in";

/** Where Google sends you back to: the app's home page, which must be listed on the Google client. */
function returnAddress(): string {
  return `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
}

/** A random value, URL-safe. */
function random(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Hex SHA-256: Google gets the nonce's hash and Supabase checks the original against it. */
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Whether the address holds a sign-in Google has just sent back. */
function returning(): boolean {
  return (
    typeof window !== "undefined" &&
    /(^#|&)(id_token|error)=/.test(window.location.hash)
  );
}

/** Goes to Google's sign-in page, which comes back to Rocket with a signed ID token. */
async function startGoogleSignIn() {
  const nonce = random();
  const state = random();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ nonce, state }));
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: returnAddress(),
    response_type: "id_token",
    scope: "openid email profile",
    nonce: await sha256(nonce),
    state,
    prompt: "select_account",
  });
  window.location.assign(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
}

/**
 * Back from Google's sign-in page: the address ends with #id_token=…&state=…. If the state is the
 * one this tab sent, Supabase checks the token (with the nonce) and signs in; a new account is
 * made the first time. Returns an error message, or null when there was nothing to finish.
 */
async function finishGoogleSignIn(): Promise<string | null> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get("id_token");
  const failed = hash.get("error");
  if (!token && !failed) return null;
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as {
    nonce: string;
    state: string;
  } | null;
  sessionStorage.removeItem(PENDING_KEY);
  // Clear the token from the address bar and history.
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
  if (failed)
    return failed === "access_denied"
      ? null
      : `Google sign-in didn't finish (${failed}).`;
  if (!pending || hash.get("state") !== pending.state)
    return "That sign-in link has expired. Try Continue with Google again.";
  const { error } = await createClient().auth.signInWithIdToken({
    provider: "google",
    token: token!,
    nonce: pending.nonce,
  });
  return error?.message ?? null;
}

/**
 * Rocket's "Continue with Google" button. It opens Google's sign-in page, which returns here (to
 * Rocket's own address, so Google names Rocket's site rather than the Supabase project) with a
 * signed ID token that Supabase checks. A plain page-to-page step, so it works the same on phones.
 */
export function GoogleSignIn({
  onError,
}: {
  onError: (message: string) => void;
}) {
  // Busy from the start when Google has just sent a sign-in back to finish.
  const [busy, setBusy] = useState(() => returning());
  const report = useRef(onError);
  useEffect(() => {
    report.current = onError;
  }, [onError]);

  // Finish a sign-in Google has just sent back.
  useEffect(() => {
    if (!returning()) return;
    finishGoogleSignIn().then((message) => {
      setBusy(false);
      if (message) report.current(message);
    });
  }, []);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        startGoogleSignIn().catch((error: Error) => {
          setBusy(false);
          report.current(error.message);
        });
      }}
      className="btn w-full"
    >
      <GoogleIcon />
      {busy ? "…" : "Continue with Google"}
    </button>
  );
}
