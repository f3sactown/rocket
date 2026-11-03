"use client";

import { SignedIn } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";

export default function NewWorkoutPage() {
  return (
    <SignedIn>
      {(user) => (
        <BackblastEditor
          mode="workout"
          user={user}
          initial={{ title: "", date: "", ao: "", q: "", attendees: [] }}
        />
      )}
    </SignedIn>
  );
}
