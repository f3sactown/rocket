/**
 * The project URL, reduced to its origin so a value pasted with a path
 * (e.g. "https://abc.supabase.co/rest/v1/") or stray whitespace still works.
 */
export const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim())
  .origin;
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim();
