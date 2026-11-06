import { createBrowserClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

/** The app's Supabase client. Access rules are enforced by row-level security in the database. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}

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
