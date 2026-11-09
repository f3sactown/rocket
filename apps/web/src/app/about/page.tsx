"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

/** What Rocket is and does, and which version is running. */
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
