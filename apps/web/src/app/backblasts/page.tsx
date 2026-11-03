"use client";

import { SignedIn } from "@/components/auth-provider";
import { ItemDashboard } from "@/components/item-dashboard";

export default function BackblastsPage() {
  return (
    <SignedIn>
      {(user) => <ItemDashboard user={user} kind="backblast" />}
    </SignedIn>
  );
}
