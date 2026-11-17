"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadRegions,
  loadRosterForSignUp,
  takenNames,
  type Region,
} from "@/lib/regions";
import { createClient, createRecoveryClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-region";
import { ArrowIcon, GoogleIcon } from "./icons";
import { setAccent } from "./theme-switcher";
import { GOOGLE_CLIENT_ID, GoogleSignIn } from "./google-sign-in";
import { Wordmark } from "./wordmark";

export function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">("sign-in");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);
  // The name about to be set for good, once it's been shown back to confirm.
  const [confirming, setConfirming] = useState<string | null>(null);
  // The region chosen, whose roster the name is picked from.
  const [regionId, setRegionId] = useState("");
  // Google is the way in; email and password sit behind a link for those without Google.
  const [useEmail, setUseEmail] = useState(false);
  const regions = useLoad(mode === "sign-up" ? () => loadRegions() : null, [
    mode,
  ]);

  /**
   * Signs in (or up) with Google through Supabase's redirect, coming back to the app's home page.
   * Used only when the site has no Google client ID for Google's own button.
   */
  async function withGoogle() {
    setPending(true);
    setMessage(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH}/`,
      },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setPending(false);
      setMessage({ text: error.message, error: true });
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();
    setPending(true);
    setMessage(null);

    if (mode === "forgot") {
      // The emailed link opens the reset page (on any device), which asks for a new password.
      const { error } = await createRecoveryClient().auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH}/reset-password/`,
        },
      );
      setPending(false);
      if (error) return setMessage({ text: error.message, error: true });
      return setMessage({
        text: "If there's an account for that email, a link to reset its password is on its way.",
        error: false,
      });
    }

    if (mode === "sign-up") {
      // The name can't be changed later: show it back once before the account is made.
      const name = String(form.get("name")).trim();
      if (confirming !== name) {
        setPending(false);
        return setConfirming(name);
      }
      const region = regions.value?.find((r) => r.id === form.get("region"));
      if (region) setAccent(region.language);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: String(form.get("name")).trim(),
            // Kept apart from `name`, which signing in with Google overwrites.
            f3_name: String(form.get("name")).trim(),
            region_id: region?.id ?? null,
            // A region sets the starting wording (F3 or FiA); it can be changed in Settings.
            ...(region && { language: region.language }),
            // The region's accent color (Red for F3, Teal for FiA), on every device.
            ...(region && { accent: region.language }),
            // A new account starts on this build, so Home's "What's new" waits for the next.
            whats_new_seen: process.env.NEXT_PUBLIC_BUILD_NUMBER,
            // Likewise the PAX page's "New on Rocket" note starts with whoever joins after them.
            pax_new_seen: new Date().toISOString(),
          },
          emailRedirectTo: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH}/`,
        },
      });
      setPending(false);
      if (error) return setMessage({ text: error.message, error: true });
      if (!data.session)
        return setMessage({
          text: "Check your email to confirm your account.",
          error: false,
        });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setPending(false);
      if (error) return setMessage({ text: error.message, error: true });
    }
  }

  if (!useEmail)
    return (
      <section className="card">
        <header className="flex items-start justify-between gap-4">
          <h1 className="pt-1 text-ink">
            <Wordmark className="h-10" />
          </h1>
          <span className="status mt-2">Sign in</span>
        </header>
        <p className="text-ink-soft">
          Sign in or create your account with Google. It&apos;s one tap, with no
          password to remember.
        </p>
        {GOOGLE_CLIENT_ID ? (
          // Google's own button, on this page: Google's prompt names Rocket's site.
          <GoogleSignIn onError={(text) => setMessage({ text, error: true })} />
        ) : (
          <button
            type="button"
            onClick={withGoogle}
            disabled={pending}
            className="btn w-full"
          >
            <GoogleIcon />
            {pending ? "…" : "Continue with Google"}
          </button>
        )}
        {message && (
          <p
            className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
          >
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setUseEmail(true);
          }}
          className="link -mt-2 self-center text-sm"
        >
          Sign in or sign up with email
        </button>
      </section>
    );

  return (
    <form onSubmit={onSubmit} className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="pt-1 text-ink">
          <Wordmark className="h-10" />
        </h1>
        <span className="status mt-2">
          {mode === "sign-in"
            ? "Sign in"
            : mode === "sign-up"
              ? "Sign up"
              : "Reset password"}
        </span>
      </header>

      <div className="panel flex flex-col gap-4">
        {mode === "sign-up" && (
          <>
            <RegionSelect
              regions={regions.value}
              onChange={(id) => {
                setRegionId(id);
                setConfirming(null);
              }}
            />
            <NameField
              region={regions.value?.find((r) => r.id === regionId)}
              onChange={() => setConfirming(null)}
            />
            {confirming && <ConfirmName name={confirming} />}
          </>
        )}
        <label className="label flex flex-col gap-1.5">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </label>
        {mode === "forgot" ? (
          <p className="text-sm text-ink-soft">
            Enter your account&apos;s email and we&apos;ll send a link to set a
            new password.
          </p>
        ) : (
          <label className="label flex flex-col gap-1.5">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              className="input"
            />
          </label>
        )}
        {mode === "sign-in" && (
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setMode("forgot");
            }}
            className="link -mt-2 self-end text-sm"
          >
            Forgot password?
          </button>
        )}
        {message && (
          <p
            className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
          >
            {message.text}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className="btn w-full">
        <ArrowIcon />
        {pending
          ? "…"
          : mode === "sign-in"
            ? "Sign in"
            : mode === "sign-up"
              ? confirming
                ? `Yes, I'm ${confirming}: create account`
                : "Create account"
              : "Send reset link"}
      </button>
      <button
        type="button"
        className="link -mt-2 self-center"
        onClick={() => {
          setMessage(null);
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
        }}
      >
        {mode === "sign-in"
          ? "Need an account? Sign up"
          : mode === "sign-up"
            ? "Have an account? Sign in"
            : "Back to sign in"}
      </button>
      <button
        type="button"
        className="link -mt-3 self-center inline-flex items-center gap-1.5 text-sm"
        onClick={() => {
          setMessage(null);
          setMode("sign-in");
          setUseEmail(false);
        }}
      >
        <GoogleIcon />
        Use Google instead
      </button>
    </form>
  );
}

/**
 * The F3 name at sign-up, chosen from the region's roster (the names in its database), with the
 * warning that it's for good: it's how the roster, backblasts and stats find you, so it can't be
 * changed once the account is made. Names already taken by a Rocket account are left out where
 * that's known (signed in, after Google). Someone not on the roster yet can say so and type it.
 */
export function NameField({
  region,
  userId,
  defaultValue = "",
  onChange,
  changing = false,
}: {
  /** Changing it in Settings (it's off the roster): a roster name only, and the warning says so. */
  changing?: boolean;
  /** The region chosen above, if any. */
  region?: Region | null;
  /** Signed in already (after Google): taken names are known then. */
  userId?: string;
  defaultValue?: string;
  onChange?: () => void;
}) {
  const roster = useLoad(
    region ? () => loadRosterForSignUp(region, !!userId) : null,
    [region?.id, !!userId],
  );
  const taken = useLoad(
    region && userId ? () => takenNames(region, userId) : null,
    [region?.id, userId],
  );
  const [notListed, setNotListed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const names = roster.value ?? [];
  const takenSet = taken.value;
  const available = names.filter((n) => !takenSet?.has(n.toLowerCase()));
  const choosing = !!region && names.length > 0 && !notListed;

  /** Why the name typed can't be used, if it can't. */
  const problem = (value: string): string => {
    const typed = value.trim().toLowerCase();
    if (!typed || !choosing) return "";
    if (takenSet?.has(typed))
      return "That name is already taken by someone on Rocket.";
    if (!names.some((n) => n.toLowerCase() === typed))
      return "Choose your name from your region's roster, exactly as it's written there.";
    return "";
  };

  // The browser won't submit the form while the name doesn't match.
  useEffect(() => {
    const el = input.current;
    if (el) el.setCustomValidity(problem(el.value));
  });

  return (
    <div className="flex flex-col gap-1.5">
      <label className="label flex flex-col gap-1.5">
        F3 name
        <input
          ref={input}
          name="name"
          required
          defaultValue={defaultValue}
          autoComplete="off"
          list={choosing ? "roster-names" : undefined}
          placeholder={choosing ? "Start typing to find your name" : undefined}
          onChange={(e) => {
            e.currentTarget.setCustomValidity(problem(e.currentTarget.value));
            onChange?.();
          }}
          // Written as the roster has it (its capitals), whatever was typed.
          onBlur={(e) => {
            const typed = e.currentTarget.value.trim().toLowerCase();
            const match = names.find((n) => n.toLowerCase() === typed);
            if (match && match !== e.currentTarget.value) {
              e.currentTarget.value = match;
              onChange?.();
            }
          }}
          className="input"
        />
      </label>
      {choosing && (
        <datalist id="roster-names">
          {available.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
      <span className="text-xs text-muted">
        {!region
          ? "Choose your region first to pick your name from its roster."
          : roster.loading
            ? "Loading the roster…"
            : roster.error || !names.length
              ? "Couldn't load the roster: type your name exactly as it's written there."
              : notListed
                ? "Type your name as it will be on the roster."
                : `${available.length} names on the ${region.name} roster. It's the name others see on your workouts and backblasts.`}
      </span>
      {!!region && names.length > 0 && !changing && (
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={notListed}
            onChange={(e) => {
              setNotListed(e.target.checked);
              onChange?.();
            }}
            className="size-4 accent-[var(--color-accent)]"
          />
          I&apos;m not on the roster yet (ask your Site Q to add you)
        </label>
      )}
      <span className="rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-ink">
        <strong>Choose carefully:</strong> your name must match the database
        (your region&apos;s roster) exactly, and it can&apos;t be changed{" "}
        {changing ? "again once it's saved" : "once your account is set up"}.
      </span>
    </div>
  );
}

/** The last check before the name is set for good. */
export function ConfirmName({ name }: { name: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-accent/60 bg-accent-soft px-3 py-2.5 text-sm text-ink"
    >
      You&apos;ll be <strong>{name}</strong> on Rocket, for good: it can&apos;t
      be changed later. Tap the button again to confirm, or fix the name above.
    </p>
  );
}

/** Region choice at sign-up; regions that aren't listed can be added in Settings afterwards. */
export function RegionSelect({
  regions,
  defaultValue = "",
  onChange,
}: {
  regions?: Region[];
  defaultValue?: string;
  /** The region's ID as it's chosen ("" for none). */
  onChange?: (id: string) => void;
}) {
  return (
    <label className="label flex flex-col gap-1.5">
      Region
      <select
        name="region"
        key={defaultValue}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        className="input"
      >
        <option value="">
          {regions ? "Not listed / choose later" : "Loading regions…"}
        </option>
        {regions?.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}
          </option>
        ))}
      </select>
      <span className="text-xs font-normal text-muted">
        Region not listed? You can add it in Settings after signing up.
      </span>
    </label>
  );
}
