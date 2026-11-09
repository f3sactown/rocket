"use client";

import { useState } from "react";
import { loadRegions } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-region";
import type { CurrentUser } from "./auth-provider";
import { RegionSelect } from "./auth-form";
import { ArrowIcon } from "./icons";
import { chooseRegion } from "./region-settings";
import { Wordmark } from "./wordmark";

/** The profile a Google sign-in starts from: the name others see, and the region if any. */
async function loadProfile(userId: string) {
  const { data } = await createClient()
    .from("profiles")
    .select("name, region_id")
    .eq("id", userId)
    .maybeSingle();
  return data ?? { name: "", region_id: null };
}

/**
 * After signing in with Google the first time (or the first time on an account that had only a
 * password), asks for the F3 name and region before going on. Google gives the account's real
 * name and no region, but Rocket matches PAX to their region's roster by F3 name.
 */
export function FinishProfile({ user }: { user: CurrentUser }) {
  const profile = useLoad(() => loadProfile(user.id), [user.id]);
  const regions = useLoad(() => loadRegions(), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hadPassword = user.providers.includes("email");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    const region = regions.value?.find((r) => r.id === form.get("region"));
    setPending(true);
    setError(null);
    const supabase = createClient();
    // The name others see on backblasts and the PAX page.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", user.id);
    if (profileError) {
      setPending(false);
      return setError(profileError.message);
    }
    if (region) {
      const message = await chooseRegion(user.id, region);
      if (message) {
        setPending(false);
        return setError(message);
      }
    }
    const { data } = await supabase.auth.getUser();
    const meta = data.user?.user_metadata ?? {};
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        name,
        // Kept apart from `name`, which each Google sign-in overwrites.
        f3_name: name,
        // A new account starts on this build and these signups, like one made with a password.
        ...(meta.whats_new_seen === undefined && {
          whats_new_seen: process.env.NEXT_PUBLIC_BUILD_NUMBER,
        }),
        ...(meta.pax_new_seen === undefined && {
          pax_new_seen: new Date().toISOString(),
        }),
      },
    });
    setPending(false);
    if (authError) setError(authError.message);
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="pt-1 text-ink">
          <Wordmark className="h-10" />
        </h1>
        <span className="status mt-2">Welcome</span>
      </header>
      <p className="text-sm text-ink-soft">
        You&apos;re signed in with Google as {user.email}. One more step: your
        F3 name and region, so Rocket can match you to your region&apos;s roster
        and show your posts and Qs.
      </p>
      {!profile.value ? (
        <div className="panel h-40 animate-pulse" />
      ) : (
        <div className="panel flex flex-col gap-4">
          <label className="label flex flex-col gap-1.5">
            F3 name
            <input
              name="name"
              required
              // A new Google account's profile holds its real name, so it starts blank; an account
              // that had a password already has its F3 name.
              defaultValue={hadPassword ? profile.value.name : ""}
              autoComplete="off"
              className="input"
            />
            <span className="text-xs font-normal text-muted">
              As it&apos;s written on your region&apos;s roster. It&apos;s the
              name others see on your workouts and backblasts.
            </span>
          </label>
          <RegionSelect
            regions={regions.value}
            defaultValue={profile.value.region_id ?? ""}
          />
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      )}
      <button
        type="submit"
        disabled={pending || !profile.value}
        className="btn w-full"
      >
        <ArrowIcon />
        {pending ? "…" : "Continue"}
      </button>
    </form>
  );
}
