"use client";

import { useState } from "react";
import { loadRegions, type Region } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-region";
import { ArrowIcon } from "./icons";
import { setAccent } from "./theme-switcher";

export function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
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
        <h1 className="card-title">Rocket</h1>
        <span className="status mt-2">
          {mode === "sign-in" ? "Sign in" : "Sign up"}
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
        {pending ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>
      <button
        type="button"
        className="link -mt-2 self-center"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in"
          ? "Need an account? Sign up"
          : "Have an account? Sign in"}
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
