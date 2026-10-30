import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

/** Create a Supabase client for the current request. Never share one across requests. */
export async function createClient() {
  // The client reads the clock while restoring the session, so wait for a real request first.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, which can't set cookies; the proxy refreshes sessions.
        }
      },
    },
  });
}
