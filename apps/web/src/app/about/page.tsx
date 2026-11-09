"use client";

import { parseChangelog } from "@rocket/core";
import Link from "next/link";
import { Fragment } from "react";
import { useAuth } from "@/components/auth-provider";

/** Every release, newest first, from CHANGELOG.md (read when the site is built). */
const RELEASES = parseChangelog(process.env.NEXT_PUBLIC_CHANGELOG ?? "");

/** A changelog item with its first letter capitalized and its **bold** parts bold. */
function Item({ text }: { text: string }) {
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return sentence
    .replace(/`/g, "")
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) =>
      i % 2 ? (
        <strong key={i} className="font-semibold text-ink">
          {part}
        </strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

/** A release date (YYYY-MM-DD) as e.g. "Nov 8, 2026". */
function releaseDate(date: string): string {
  if (!date) return "";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** What Rocket is and does, which version is running, and every release's changes. */
export default function AboutPage() {
  const { user } = useAuth();
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  const build = process.env.NEXT_PUBLIC_BUILD_NUMBER;
  const commit = process.env.NEXT_PUBLIC_COMMIT;

  return (
    <article className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">About Rocket</h1>
        <p className="text-sm text-muted">Q Planner</p>
      </header>

      <p className="text-ink-soft">
        Rocket helps a Q plan a workout, run it, and then write and share the
        backblast. It&apos;s made for F3 and FiA PAX, and it&apos;s free.
      </p>

      <Section title="What you can do">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-accent">
          <li>
            <strong className="text-ink">Plan a workout</strong> section by
            section, with saved templates and exercises from the F3, FiA and
            region Exicons in the Library.
          </li>
          <li>
            <strong className="text-ink">Run it</strong> with a timer on each
            thang: countdown, stopwatch, AMRAP, Tabata or EMOM.
          </li>
          <li>
            <strong className="text-ink">Write the backblast</strong> from the
            workout, with your region&apos;s AOs and roster, and copy or share
            it ready for Band and Slack.
          </li>
          <li>
            <strong className="text-ink">Discover</strong> other Qs&apos; public
            workouts, like them and reuse them.
          </li>
          <li>
            <strong className="text-ink">Look up PAX</strong>: their posts and
            Qs in each region, and their public workouts and backblasts.
          </li>
        </ul>
      </Section>

      <Section title="Your data">
        <p>
          Finished workouts and backblasts are public to signed-in PAX unless
          you make them private; drafts and private ones only you can see. Your
          region&apos;s sheet supplies the AOs, roster and post counts. You can
          export everything you have, import it back, or reset your account, in{" "}
          {user ? (
            <Link href="/settings" className="underline">
              Settings
            </Link>
          ) : (
            "Settings"
          )}
          .
        </p>
      </Section>

      <Section title="Version">
        <p className="font-mono text-sm">
          v{version}
          {build && ` · build ${build}${commit ? ` (${commit})` : ""}`}
        </p>
        <p>
          Rocket is in alpha: new things arrive often, and Home tells you
          what&apos;s new after each update.
        </p>
      </Section>

      {RELEASES.length > 0 && (
        <Section title="Changelog">
          <p>What changed in each release, newest first. Tap one to see it.</p>
          <div className="flex flex-col gap-2">
            {RELEASES.map((release, index) => (
              <details
                key={release.version}
                open={index === 0}
                className="group rounded-xl border border-line"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-sm text-ink">
                    v{release.version}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {releaseDate(release.date)}
                    <span
                      aria-hidden
                      className="transition-transform group-open:rotate-90"
                    >
                      ›
                    </span>
                  </span>
                </summary>
                <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
                  {release.sections.map((section) => (
                    <div key={section.title} className="flex flex-col gap-1">
                      {section.title && (
                        <span className="label">{section.title}</span>
                      )}
                      <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-accent">
                        {section.items.map((item) => (
                          <li key={item}>
                            <Item text={item} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 text-sm text-ink-soft">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}
