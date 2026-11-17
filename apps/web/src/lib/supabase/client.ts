import { createBrowserClient } from "@supabase/ssr";
import {
  createClient as createPlainClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

/**
 * How long a request waits for an expired sign-in (they last an hour) to be renewed before going
 * ahead with the one kept on this device. Offline, Supabase keeps trying to renew it for about
 * half a minute; meanwhile, kept copies of the data answer (the service worker matches them by
 * address, whatever the sign-in).
 */
const RENEW_WAIT_MS = 3000;

const OFFLINE_USER = "rocket-offline-user";
const OFFLINE_TOKEN = "rocket-offline-token";

/**
 * Keeps the signed-in account and its access token on this device (or forgets them, signed out),
 * so Rocket carries on as this account offline, when the sign-in can't be renewed.
 */
export function keepSession(session: Session | null) {
  try {
    if (session) {
      localStorage.setItem(OFFLINE_USER, JSON.stringify(session.user));
      localStorage.setItem(OFFLINE_TOKEN, session.access_token);
    } else {
      localStorage.removeItem(OFFLINE_USER);
      localStorage.removeItem(OFFLINE_TOKEN);
    }
  } catch {
    // Not kept: offline, it asks to sign in again.
  }
}

/** The account kept on this device, if any. */
export function keptUser(): User | undefined {
  try {
    const kept = localStorage.getItem(OFFLINE_USER);
    return kept ? (JSON.parse(kept) as User) : undefined;
  } catch {
    return undefined;
  }
}

function keptToken(): string | null {
  try {
    return localStorage.getItem(OFFLINE_TOKEN);
  } catch {
    return null;
  }
}

let client: SupabaseClient<Database> | null = null;

/**
 * The app's Supabase client. Access rules are enforced by row-level security in the database.
 * Sign-in (`auth`) is Supabase's own browser client; data requests go through a second client
 * that asks it for the access token, but doesn't wait more than a few seconds for an expired one
 * to be renewed (offline, that takes about half a minute) before using the token kept on this
 * device.
 */
export function createClient(): SupabaseClient<Database> {
  // Prerendering the pages: the plain browser client (it keeps nothing there).
  if (typeof window === "undefined")
    return createBrowserClient<Database>(supabaseUrl, supabaseKey);
  if (client) return client;
  const main = createBrowserClient<Database>(supabaseUrl, supabaseKey);
  // Whether renewing the sign-in is stuck (offline): requests then go ahead with the kept
  // token at once, until a renewal gets through.
  let stuck = false;
  const data = createPlainClient<Database>(supabaseUrl, supabaseKey, {
    // No retrying a request that couldn't reach the server (1, 2, then 4 seconds more): offline,
    // the service worker answers from its kept copies, or says there isn't one.
    db: { retry: false },
    accessToken: async () => {
      let answered = false;
      const session = main.auth.getSession().then(({ data }) => {
        answered = true;
        const token = data.session?.access_token ?? null;
        if (token) stuck = false;
        return token;
      });
      const kept = keptToken();
      // Never signed in on this device: wait for the sign-in, however long.
      if (!kept) return session;
      if (stuck) return kept;
      return Promise.race([
        session,
        new Promise<string>((resolve) =>
          setTimeout(() => {
            if (!answered) stuck = true;
            resolve(kept);
          }, RENEW_WAIT_MS),
        ),
      ]);
    },
  });
  client = new Proxy(main, {
    get(target, prop, receiver) {
      if (prop === "auth") return Reflect.get(target, prop, receiver);
      const value = Reflect.get(data, prop, data);
      return typeof value === "function" ? value.bind(data) : value;
    },
  });
  return client;
}

/** How long the app waits for the sign-in before carrying on as the account kept on this device. */
export const SIGN_IN_WAIT_MS = RENEW_WAIT_MS;

/**
 * A client for asking for a password reset email. It asks without the same-browser handshake the
 * app's client uses, so Supabase's standard email link signs you in on any device (the link
 * returns with the session in the address). It keeps nothing itself.
 */
export function createRecoveryClient() {
  return createPlainClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
