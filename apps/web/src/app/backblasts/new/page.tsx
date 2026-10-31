"use client";

import Link from "next/link";
import { SignedIn } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";

export default function NewBackblastPage() {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
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
