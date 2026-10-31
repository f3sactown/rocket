"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  return (
    <button className="link" onClick={() => createClient().auth.signOut()}>
      Sign out
    </button>
  );
}
