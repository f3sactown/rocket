"use client";

import { SignedIn } from "@/components/auth-provider";
import { LibraryBrowser } from "@/components/library-picker";

export default function LibraryPage() {
  return (
    <SignedIn>
      {() => (
        <section className="card">
          <header className="flex flex-col gap-1">
            <h1 className="card-title">Library</h1>
            <p className="text-sm text-muted">
              Exercises and routines from the{" "}
              <a
                href="https://codex.f3nation.com/exicon"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                F3
              </a>{" "}
              and{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/1-aBi3UGOwhGChtKEFdVjikbqfcCWP35mcoKqqxqKssI/edit"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                FiA
              </a>{" "}
              Exicons (updated weekly), plus each region&apos;s own Exicon from
              its sheet (updated daily). Tap one to read it or copy it.
            </p>
          </header>
          <LibraryBrowser />
        </section>
      )}
    </SignedIn>
  );
}
