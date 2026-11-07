"use client";

import { useState } from "react";
import { loadRegions, type Region } from "@/lib/regions";
import { createClient, createRecoveryClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-region";
import { ArrowIcon } from "./icons";
import { setAccent } from "./theme-switcher";
import { Wordmark } from "./wordmark";

export function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">("sign-in");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const regions = useLoad(mode === "sign-up" ? () => loadRegions() : null, [
    mode,
  ]);

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
      const region = regions.value?.find((r) => r.id === form.get("region"));
      if (region) setAccent(region.language);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: String(form.get("name")).trim(),
            region_id: region?.id ?? null,
            // A region sets the starting wording (F3 or FiA); it can be changed in Settings.
            ...(region && { language: region.language }),
            // A new account starts on this version, so Home's "What's new" waits for the next.
            whats_new_seen: process.env.NEXT_PUBLIC_APP_VERSION,
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
            <label className="label flex flex-col gap-1.5">
              F3 name
              <input name="name" required className="input" />
            </label>
            <RegionSelect regions={regions.value} />
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
              ? "Create account"
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
    </form>
  );
}

/** Region choice at sign-up; regions that aren't listed can be added in Settings afterwards. */
function RegionSelect({ regions }: { regions?: Region[] }) {
  return (
    <label className="label flex flex-col gap-1.5">
      Region
      <select name="region" defaultValue="" className="input">
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
