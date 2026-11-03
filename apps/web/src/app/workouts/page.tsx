"use client";

import { SignedIn } from "@/components/auth-provider";
import { ItemDashboard } from "@/components/item-dashboard";

export default function WorkoutsPage() {
  return (
    <SignedIn>
      {(user) => <ItemDashboard user={user} kind="workout" />}
    </SignedIn>
  );
}
