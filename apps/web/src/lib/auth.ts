import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export interface CurrentUser {
  id: string;
  name: string;
}

/** The signed-in user, or null. */
export async function getUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;
  const { sub, email, user_metadata } = data.claims;
  return {
    id: sub,
    name: (user_metadata?.name as string | undefined) || email || "PAX",
  };
}

/** Returns the signed-in user, or redirects to the home page to sign in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/");
  return user;
}
