"use client";

import { useRef, useState } from "react";
import { LANGUAGES, type Language } from "@rocket/core";
import {
  SignedIn,
  useTerms,
  HOME_SECTIONS,
  type CurrentUser,
  type HomeSection,
  type SwipeAction,
} from "@/components/auth-provider";
import { AccountData } from "@/components/account-data";
import { NOTICES } from "@/components/notice-dialog";
import { PasswordInput } from "@/components/password-input";
import { RegionSettings } from "@/components/region-settings";
import {
  AccentPicker,
  SplashToggle,
  ThemeSwitcher,
} from "@/components/theme-switcher";
import {
  VisibilitySwitch,
  type Visibility,
} from "@/components/visibility-switch";
import { createClient } from "@/lib/supabase/client";
import { useRegionScope } from "@/lib/use-region";

export default function SettingsPage() {
  return (
    <>
      <SignedIn>{(user) => <Settings user={user} />}</SignedIn>
    </>
  );
}

type Result = { text: string; error: boolean } | null;

/** A settings form: runs `save`, which returns a message to show, and tracks its progress. */
function Section({
  title,
  description,
  submitLabel,
  save,
  children,
}: {
  title: string;
  description?: string;
  submitLabel?: string;
  save?: () => Promise<Result>;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);

  // Sections without a Save button aren't forms, so they can hold forms of their own.
  const Container = save ? "form" : "section";

  return (
    <Container
      className="panel flex flex-col gap-4"
      onSubmit={async (event: React.FormEvent) => {
        event.preventDefault();
        if (!save) return;
        setPending(true);
        setResult(null);
        setResult(await save());
        setPending(false);
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-ink">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
      {(save || result) && (
        <div className="flex flex-wrap items-center gap-3">
          {save && (
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50"
            >
              {pending ? "Saving…" : (submitLabel ?? "Save")}
            </button>
          )}
          {result && (
            <p
              className={`text-sm ${result.error ? "text-accent" : "text-ink-soft"}`}
            >
              {result.text}
            </p>
          )}
        </div>
      )}
    </Container>
  );
}

function Settings({ user }: { user: CurrentUser }) {
  const terms = useTerms();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameResult, setNameResult] = useState<Result>(null);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Saves the name shortly after the last keystroke. */
  function changeName(value: string) {
    setName(value);
    setNameResult({ text: "Saving…", error: false });
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(
      async () => setNameResult(await saveName(value)),
      800,
    );
  }

  async function saveName(value: string): Promise<Result> {
    const trimmed = value.trim();
    if (!trimmed)
      return { text: `Your ${terms.org} name can't be empty.`, error: true };
    const supabase = createClient();
    // The profile name is what others see on your backblasts; the account copy is shown to you.
    const { error } = await supabase
      .from("profiles")
      .update({ name: trimmed })
      .eq("id", user.id);
    if (error) return { text: error.message, error: true };
    const { error: authError } = await supabase.auth.updateUser({
      // f3_name too, since signing in with Google overwrites `name`.
      data: { name: trimmed, f3_name: trimmed },
    });
    if (authError) return { text: authError.message, error: true };
    return { text: "Name saved.", error: false };
  }

  async function saveEmail(): Promise<Result> {
    const trimmed = email.trim();
    if (trimmed === user.email)
      return { text: "That's already your email.", error: false };
    const { error } = await createClient().auth.updateUser(
      { email: trimmed },
      {
        emailRedirectTo: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH}/settings/`,
      },
    );
    if (error) return { text: error.message, error: true };
    return {
      text: `Check your inbox to confirm the change. Until then, keep signing in with ${user.email}.`,
      error: false,
    };
  }

  async function savePassword(): Promise<Result> {
    if (password.length < 8)
      return { text: "Use at least 8 characters.", error: true };
    if (password !== confirmPassword)
      return { text: "The passwords don't match.", error: true };
    const { error } = await createClient().auth.updateUser({ password });
    if (error) return { text: error.message, error: true };
    setPassword("");
    setConfirmPassword("");
    return { text: "Password changed.", error: false };
  }

  return (
    <section className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">Settings</h1>
        <span className="status mt-2">{user.name}</span>
      </header>

      <Section
        title="Profile"
        description={`Your ${terms.org} name is shown on the backblasts you write. Changes save as you type.`}
      >
        <label className="label flex flex-col gap-1.5">
          {terms.org} name
          <input
            required
            value={name}
            onChange={(e) => changeName(e.target.value)}
            className="input"
          />
        </label>
        {nameResult && (
          <p
            className={`-mt-2 text-sm ${nameResult.error ? "text-accent" : "text-muted"}`}
          >
            {nameResult.text}
          </p>
        )}
      </Section>

      <Section
        title="Email"
        description="Used to sign in. You'll confirm a new address from your inbox."
        submitLabel="Change email"
        save={saveEmail}
      >
        <label className="label flex flex-col gap-1.5">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>
      </Section>

      <Section
        title="Password"
        submitLabel="Change password"
        save={savePassword}
      >
        <label className="label flex flex-col gap-1.5">
          New password
          <PasswordInput
            aria-label="New password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </label>
        <label className="label flex flex-col gap-1.5">
          Confirm new password
          <PasswordInput
            aria-label="Confirm new password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
          />
        </label>
      </Section>

      <Section
        title="Region"
        description="Your region's Google Sheet supplies AOs, PAX names and attendance when you write a backblast."
      >
        <RegionSettings user={user} />
      </Section>

      <Section
        title="Organization"
        description="Whether you post with F3 or FiA. It also sets the words the app uses: F3 says Warm-o-rama, The Thang and Coffeeteria; FiA says Warm-up, The Workout and CoFiA. Saved to your account."
      >
        <OrganizationPicker user={user} />
      </Section>

      <Section
        title="Appearance"
        description="The accent color is saved to your account, so it follows you to every device; the theme and launch animation are saved on this device."
      >
        <div className="flex flex-col gap-2">
          <span className="label">Theme</span>
          <ThemeSwitcher />
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">Accent color</span>
          <AccentPicker />
        </div>
        <SplashToggle />
      </Section>

      <Section
        title="Home screen"
        description="Choose what Home shows. Saved to your account."
      >
        <HomeSectionsPicker sections={user.homeSections} />
      </Section>

      <Section title="Sharing" description="Saved to your account.">
        <DefaultVisibility
          label="New workouts start"
          hint="Public workouts show on Discover and your PAX profile, where others can like and reuse them. You can change each one on its page."
          saved={user.defaultWorkoutVisibility}
          metaKey="default_workout_visibility"
        />
        <DefaultVisibility
          label="New backblasts start"
          hint="Public backblasts show on your PAX profile. You can change each one on its page."
          saved={user.defaultBackblastVisibility}
          metaKey="default_backblast_visibility"
        />
        <AccountSwitch
          divided
          on={user.shareWorkoutLink}
          label="Link to the workout in shared workouts and backblasts"
          hint="When a public workout, or a backblast from one, is copied or shared, it ends with a link to that workout, asking PAX to like it and reuse it. Not shown on screen."
          save={(on) => ({ share_workout_link: on })}
        />
      </Section>

      <Section
        title="Notifications"
        description="Notices you chose not to show again. Saved to your account."
      >
        <NoticeReset off={user.noticesOff} />
      </Section>

      <Section
        title="Swipe actions"
        description="Swipe a backblast in a list to act on it. You can only delete your own. Saved to your account."
      >
        <SwipePicker swipeLeft={user.swipeLeft} />
      </Section>

      <Section
        title="Your data"
        description="Take your data with you, bring it back, or start fresh."
      >
        <AccountData />
      </Section>

      <Section
        title="Account"
        description={`Your account ID is permanent and unique. Everything you write is tied to it, so people who share an ${terms.org} name never affect each other's data.`}
      >
        <div className="flex flex-col gap-1.5">
          <span className="label">Account ID</span>
          <code className="rounded-xl border border-line px-3.5 py-2.5 font-mono text-xs break-all text-ink-soft">
            {user.id}
          </code>
        </div>
        <button
          type="button"
          onClick={() => createClient().auth.signOut()}
          className="link self-start"
        >
          Sign out
        </button>
      </Section>
    </section>
  );
}

/** The silenced notices, with a button to show them again. */
function NoticeReset({ off }: { off: string[] }) {
  const [silenced, setSilenced] = useState(
    off.filter((id) => NOTICES[id] !== undefined),
  );
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function reset() {
    setPending(true);
    setResult(null);
    const { error } = await createClient().auth.updateUser({
      data: { notices_off: [] },
    });
    setPending(false);
    if (error) return setResult({ text: error.message, error: true });
    setSilenced([]);
    setResult({ text: "Notices will show again.", error: false });
  }

  return (
    <div className="flex flex-col gap-3">
      {silenced.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft marker:text-accent">
          {silenced.map((id) => (
            <li key={id}>{NOTICES[id]}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Every notice is showing.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={pending || !silenced.length}
          className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Reset notifications"}
        </button>
        {result && (
          <p
            className={`text-sm ${result.error ? "text-accent" : "text-ink-soft"}`}
          >
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * An on/off setting saved to the account: `save(on)` returns what to store in its metadata.
 */
/** Whether new workouts or backblasts start public or private, saved to the account. */
function DefaultVisibility({
  label,
  hint,
  saved,
  metaKey,
}: {
  label: string;
  hint: string;
  saved: Visibility;
  metaKey: "default_workout_visibility" | "default_backblast_visibility";
}) {
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: Visibility) {
    const before = value;
    setValue(next);
    setError(null);
    const { error } = await createClient().auth.updateUser({
      data: { [metaKey]: next },
    });
    if (error) {
      setValue(before);
      setError(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="flex flex-col">
          <span className="text-sm text-ink">{label}</span>
          <span className="text-xs text-muted">{hint}</span>
        </span>
        <VisibilitySwitch value={value} onChange={choose} label={label} />
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

function AccountSwitch({
  on: saved,
  label,
  hint,
  save,
  divided = false,
}: {
  on: boolean;
  label: string;
  hint?: string;
  save: (on: boolean) => Record<string, unknown>;
  /** A line above it, when it follows other switches in the same section. */
  divided?: boolean;
}) {
  const [on, setOn] = useState(saved);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    const { error } = await createClient().auth.updateUser({
      data: save(next),
    });
    if (error) {
      setOn(!next);
      setError(error.message);
    }
  }

  return (
    <div
      className={`flex flex-col gap-1 ${divided ? "border-t border-line pt-3" : ""}`}
    >
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="flex flex-col">
          <span className="text-sm text-ink">{label}</span>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
            on ? "border-accent/60 bg-accent" : "border-line-strong bg-panel"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5.5 rounded-full bg-white shadow transition-[left] ${
              on ? "left-[calc(100%-1.5rem)]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

/** Switches for each section Home can show. */
function HomeSectionsPicker({ sections }: { sections: HomeSection[] }) {
  const [chosen, setChosen] = useState(sections);
  const [error, setError] = useState<string | null>(null);

  async function toggle(section: HomeSection) {
    const next = chosen.includes(section)
      ? chosen.filter((s) => s !== section)
      : [...chosen, section];
    const before = chosen;
    setChosen(next);
    setError(null);
    const { error } = await createClient().auth.updateUser({
      // Also which sections existed, so ones added later can start on.
      data: {
        home_sections: next,
        home_sections_seen: HOME_SECTIONS.map((s) => s.value),
      },
    });
    if (error) {
      setChosen(before);
      setError(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {HOME_SECTIONS.map((option) => {
        const on = chosen.includes(option.value);
        return (
          <div
            key={option.value}
            className="flex items-center justify-between gap-3 py-1.5"
          >
            <span className="text-sm text-ink">{option.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={option.label}
              onClick={() => toggle(option.value)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
                on
                  ? "border-accent/60 bg-accent"
                  : "border-line-strong bg-panel"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5.5 rounded-full bg-white shadow transition-[left] ${
                  on ? "left-[calc(100%-1.5rem)]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        );
      })}
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

const SWIPE_OPTIONS: { value: SwipeAction; label: string }[] = [
  { value: "delete", label: "Left deletes, right archives" },
  { value: "archive", label: "Left archives, right deletes" },
];

/** Which swipe direction deletes and which archives. */
function SwipePicker({ swipeLeft }: { swipeLeft: SwipeAction }) {
  const [pending, setPending] = useState<SwipeAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = pending ?? swipeLeft;

  async function choose(value: SwipeAction) {
    if (value === swipeLeft) return;
    setPending(value);
    setError(null);
    const { error } = await createClient().auth.updateUser({
      data: { swipe_left: value },
    });
    if (error) setError(error.message);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Swipe actions"
        className="flex flex-col gap-2"
      >
        {SWIPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected === option.value}
            disabled={pending !== null}
            onClick={() => choose(option.value)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
              selected === option.value
                ? "border-accent/60 bg-accent-soft text-ink"
                : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
            }`}
          >
            <span
              className={`size-3.5 shrink-0 rounded-full border ${
                selected === option.value
                  ? "border-accent bg-accent"
                  : "border-line-strong"
              }`}
            />
            {option.label}
            {option.value === "delete" && (
              <span className="ml-auto text-xs font-normal text-muted">
                Standard
              </span>
            )}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

/**
 * F3 or FiA, saved to the account. A shared region, or "all F3 (or FiA) regions", sets it, so it's
 * locked while you have one; with no region, or one you added yourself, you choose.
 */
function OrganizationPicker({ user }: { user: CurrentUser }) {
  const scope = useRegionScope();
  const [pending, setPending] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);
  const single = scope && !scope.all ? scope.regions[0] : undefined;
  const lockedBy: { name: string; language: Language } | null = scope?.all
    ? { name: scope.label, language: scope.all }
    : single && single.created_by !== user.id
      ? single
      : null;
  const language = lockedBy ? lockedBy.language : user.language;
  const selected = pending ?? language;

  async function choose(value: Language) {
    if (lockedBy || value === language) return;
    setPending(value);
    setError(null);
    // The auth provider picks up the change and every screen switches words.
    const { error } = await createClient().auth.updateUser({
      data: { language: value },
    });
    if (error) setError(error.message);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Organization"
        aria-disabled={lockedBy ? true : undefined}
        className={`inline-flex gap-1 self-start rounded-full border border-line bg-panel p-1 ${
          lockedBy ? "opacity-60" : ""
        }`}
      >
        {LANGUAGES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected === option.value}
            disabled={pending !== null || scope === undefined || !!lockedBy}
            onClick={() => choose(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selected === option.value
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {lockedBy && (
        <p className="text-sm text-ink-soft">
          Set by your region choice ({lockedBy.name}). To change it, choose a
          different region (or no region) above.
        </p>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
