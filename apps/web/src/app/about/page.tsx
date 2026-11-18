"use client";

import { parseChangelog } from "@rocket/core";
import Link from "next/link";
import { Fragment } from "react";
import { useAuth } from "@/components/auth-provider";
import { MailIcon } from "@/components/icons";

/** Where to write to the developer. */
const CONTACT_EMAIL = "contact@f3sactown.com";

/** Opens the phone's mail app to the developer, the subject naming the version. */
const CONTACT_LINK = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  `Rocket v${process.env.NEXT_PUBLIC_APP_VERSION ?? ""} (build ${process.env.NEXT_PUBLIC_BUILD_NUMBER ?? ""})`,
)}`;

/** One thing Rocket does: its name in bold, then what it means. */
function Feature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <strong className="text-ink">{title}.</strong> {children}
    </li>
  );
}

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
          <Feature title="Plan a workout">
            Page by page: Basics, Introduction, Warm-o-rama, The Thang, your own
            Notes and Words of Wisdom. It saves as you type. Save any section as
            a template, and star one to start every new workout with it. Add
            exercises from the Exicon, and give each thang a timer and a song.
          </Feature>
          <Feature title="Generate a workout">
            Choose 2 to 5 Exicon tags and Rocket puts a warm-up and thangs
            together at random, with timers and each exercise&apos;s
            description, ready to make your own.
          </Feature>
          <Feature title="Run it at the AO">
            Every thang with its timer (countdown, stopwatch, AMRAP, Tabata or
            EMOM), beeps for the last seconds, a 5-minute warning before the
            end, and the screen kept on.
          </Feature>
          <Feature title="Write the backblast">
            Straight from the workout, which it shares: change either and both
            change. Name-o-rama suggests your region&apos;s roster and the
            AO&apos;s regulars, with FNGs, 2.0s and downrange PAX. Then
            Announcements and Coffeeteria, and copy or share it for Band or
            Slack.
          </Feature>
          <Feature title="Share and discover">
            Make a workout or backblast public or private, share a link to it,
            and see what other Qs are doing on Discover: trending, most liked,
            most reused, at your region&apos;s AOs and newest. Like a workout,
            or reuse it as your own.
          </Feature>
          <Feature title="The Exicon">
            Exercises and routines from the F3 and FiA Exicons and your
            region&apos;s own, searchable and filtered by tag.
          </Feature>
          <Feature title="PAX">
            Everyone on your region&apos;s roster, their posts and Qs in each
            region, who&apos;s on Rocket, and each PAX&apos;s public workouts
            and backblasts.
          </Feature>
          <Feature title="Home">
            Your posts and Qs, the likes and reuses of your workouts, and
            today&apos;s, upcoming and recent workouts and backblasts, with your
            drafts. Choose which sections show in Settings.
          </Feature>
          <Feature title="Keep things tidy">
            Swipe to archive or delete, with Undo. The Archive keeps what
            you&apos;ve put away, and Search finds any workout or backblast by
            any word.
          </Feature>
          <Feature title="Reminders">
            Notifications the day before and before your workouts, a nudge to
            write the backblast, drafts left unfinished, likes and reuses, and
            new PAX on Rocket. Choose which and when.
          </Feature>
          <Feature title="Works with no signal">
            Your workouts, running them and writing backblasts work offline.
            What you write is kept on your phone and saved once you&apos;re back
            online.
          </Feature>
          <Feature title="Made for you">
            Install it as an app, take the tour, use F3 or FiA words, and pick
            light or dark and an accent color.
          </Feature>
        </ul>
      </Section>

      <Section title="Contact the developer">
        <p>
          Questions, problems or ideas? Rocket is being tested, and every note
          helps.
        </p>
        <a href={CONTACT_LINK} className="btn self-start px-5">
          <MailIcon />
          Email {CONTACT_EMAIL}
        </a>
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
          Rocket is in beta: it&apos;s being tested by PAX, new things still
          arrive often, and Home tells you what&apos;s new after each update.
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
