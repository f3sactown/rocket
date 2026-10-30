"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="link"
      onClick={async () => {
        await createClient().auth.signOut();
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
