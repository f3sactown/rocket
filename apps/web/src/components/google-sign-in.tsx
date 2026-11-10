"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/** The Google OAuth client's ID; without it, sign-in goes through Supabase's redirect instead. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** The parts of Google Identity Services used here. */
interface GoogleAccounts {
  id: {
    initialize(options: {
      client_id: string;
      nonce: string;
      callback: (response: { credential: string }) => void;
      use_fedcm_for_button?: boolean;
    }): void;
    renderButton(
      parent: HTMLElement,
      options: Record<string, string | number>,
    ): void;
  };
}

let script: Promise<GoogleAccounts> | null = null;

/** Loads Google's sign-in script once. */
function loadGoogle(): Promise<GoogleAccounts> {
  script ??= new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://accounts.google.com/gsi/client";
    tag.async = true;
    tag.onload = () => {
      const google = (
        window as unknown as { google?: { accounts: GoogleAccounts } }
      ).google;
      if (google) resolve(google.accounts);
      else reject(new Error("Google sign-in didn't load."));
    };
    tag.onerror = () => {
      script = null;
      reject(new Error("Google sign-in couldn't load. Check your connection."));
    };
    document.head.appendChild(tag);
  });
  return script;
}

/** A random one-time value, and its SHA-256 for Google (Supabase checks the original). */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  const hashed = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

/**
 * Google's own "Continue with Google" button, on Rocket's page. Google's prompt names this site
 * rather than the Supabase project, and there's no trip away: Google hands back a signed token,
 * which Supabase checks and signs in with (a new account is made the first time).
 */
export function GoogleSignIn({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const report = useRef(onError);
  useEffect(() => {
    report.current = onError;
  }, [onError]);

  useEffect(() => {
    let gone = false;
    (async () => {
      const [google, nonce] = await Promise.all([loadGoogle(), makeNonce()]);
      if (gone || !box.current) return;
      google.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: nonce.hashed,
        use_fedcm_for_button: true,
        callback: async ({ credential }) => {
          const { error } = await createClient().auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce: nonce.raw,
          });
          if (error) report.current(error.message);
        },
      });
      const dark =
        document.documentElement.dataset.theme === "dark" ||
        (document.documentElement.dataset.theme !== "light" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      google.id.renderButton(box.current, {
        type: "standard",
        theme: dark ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        width: Math.min(400, Math.max(200, box.current.offsetWidth)),
      });
    })().catch((error: Error) => report.current(error.message));
    return () => {
      gone = true;
    };
  }, []);

  return <div ref={box} className="flex min-h-11 w-full justify-center" />;
}
