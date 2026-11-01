"use client";

import { SignedIn } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";

export default function NewBackblastPage() {
  return (
    <>
      <SignedIn>
        {(user) => (
          <BackblastEditor
            user={user}
            initial={{
              title: "",
              date: "",
              ao: "",
              q: user.name,
              attendees: [],
            }}
          />
        )}
      </SignedIn>
    </>
  );
}
