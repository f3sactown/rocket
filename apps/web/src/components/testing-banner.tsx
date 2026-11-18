/** "alpha" or "beta" while Rocket's version is a test release (0.1.0-beta.1), else nothing. */
const STAGE = /-(alpha|beta)\b/i
  .exec(process.env.NEXT_PUBLIC_APP_VERSION ?? "")?.[1]
  ?.toLowerCase();

/**
 * Across the top of every screen while Rocket is in alpha or beta: it's being tested, so things
 * may change or not work as expected. Goes away by itself with the first full release.
 */
export function TestingBanner() {
  if (!STAGE) return null;
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 border-b border-line-strong bg-panel px-4 pt-[calc(env(safe-area-inset-top)+0.375rem)] pb-1.5 text-center text-xs text-ink-soft"
    >
      <span className="rounded-full border border-accent/60 bg-accent-soft px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide text-accent uppercase">
        {STAGE}
      </span>
      <span>
        Rocket is being tested: things may change or not work as expected.
        Please contact the developer with any issues.
      </span>
    </div>
  );
}
