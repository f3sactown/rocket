import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

/** The app's Supabase client. Access rules are enforced by row-level security in the database. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
