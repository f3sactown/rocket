"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "./icons";

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

/** The size Google draws its button at (its largest), before it's stretched over Rocket's. */
const GOOGLE_WIDTH = 400;
const GOOGLE_HEIGHT = 44;

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
  const wrap = useRef<HTMLDivElement>(null);
  const report = useRef(onError);
  useEffect(() => {
    report.current = onError;
  }, [onError]);

  useEffect(() => {
    let gone = false;
    // Keep it covering Rocket's button as the page resizes.
    const fit = () => {
      const area = wrap.current;
      const inner = box.current;
      if (!area || !inner) return;
      inner.style.transform = `scale(${area.offsetWidth / GOOGLE_WIDTH}, ${area.offsetHeight / GOOGLE_HEIGHT})`;
    };
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
      // Google's button, drawn at its widest and stretched over Rocket's to cover it exactly.
      google.id.renderButton(box.current, {
        type: "standard",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: GOOGLE_WIDTH,
      });
      fit();
    })().catch((error: Error) => report.current(error.message));
    window.addEventListener("resize", fit);
    return () => {
      gone = true;
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    // Rocket's own button is what shows; Google's real one sits over it, invisible, so a tap
    // lands on Google's (as its sign-in needs) while the page keeps its look.
    <div
      ref={wrap}
      className="relative w-full rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/60"
    >
      <div aria-hidden className="btn pointer-events-none w-full">
        <GoogleIcon />
        Continue with Google
      </div>
      <div
        ref={box}
        className="absolute top-0 left-0 origin-top-left opacity-[0.01]"
        style={{ width: GOOGLE_WIDTH, height: GOOGLE_HEIGHT }}
      />
    </div>
  );
}
