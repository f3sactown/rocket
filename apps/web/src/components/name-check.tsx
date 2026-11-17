"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { loadRoster, type Region } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad, useUserRegion } from "@/lib/use-region";
import { useAuth, type CurrentUser } from "./auth-provider";
import { ConfirmName, NameField } from "./auth-form";

/**
 * Whether your name is still on your region's roster (the names in its database): undefined
 * while that's being found out, or when it can't be (no region, or the roster won't load).
 */
export function useNameOnRoster(user: CurrentUser | null): {
  region: Region | null | undefined;
  onRoster: boolean | undefined;
} {
  const region = useUserRegion();
  const roster = useLoad(region && user ? () => loadRoster(region) : null, [
    region?.id,
    user?.id,
  ]);
  if (!user || !region || !roster.value?.length)
    return { region, onRoster: undefined };
  const name = user.name.trim().toLowerCase();
  return {
    region,
    onRoster: roster.value.some((n) => n.toLowerCase() === name),
  };
}

const DISMISSED = "rocket-name-check-dismissed";

/**
 * On signing in, if your name is no longer on your region's roster (it was renamed or corrected
 * there): says so and points to Settings, where it can be changed to match. "Not now" hides it
 * until the next time Rocket opens.
 */
export function NameCheck() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { region, onRoster } = useNameOnRoster(user);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED) === "1";
    } catch {
      return false;
    }
  });
  if (!user || user.needsProfile || onRoster !== false || dismissed)
    return null;
  // Settings shows it beside the name, where it's changed.
  if (pathname.replace(/\/$/, "") === "/settings") return null;
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-2xl border border-accent/60 bg-accent-soft px-4 py-3 text-sm text-ink"
    >
      <p>
        Your name <strong>{user.name}</strong> isn&apos;t on the {region?.name}{" "}
        roster anymore, so your posts and Qs can&apos;t be matched to you.
        Choose your name as it&apos;s now written there.
      </p>
      <span className="flex items-center gap-4">
        <Link href="/settings#profile" className="link font-medium text-ink">
          Fix it in Settings →
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISSED, "1");
            } catch {
              // Hidden for now only.
            }
            setDismissed(true);
          }}
          className="link text-sm"
        >
          Not now
        </button>
      </span>
    </div>
  );
}

/**
 * Settings → Profile: your name, which can't be changed, unless it's no longer on your region's
 * roster; then it can be changed to one of the roster's names (not one taken on Rocket).
 */
export function ProfileName({
  user,
  label,
}: {
  user: CurrentUser;
  label: string;
}) {
  const { region, onRoster } = useNameOnRoster(user);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  if (onRoster !== false)
    return (
      <div className="flex flex-col gap-1.5">
        <span className="label">{label}</span>
        {/* Set at sign-up for good: the roster, backblasts and stats all find you by it. */}
        <p className="input cursor-default text-ink" aria-readonly="true">
          {user.name}
        </p>
        <span className="text-xs text-muted">
          {message && !message.error
            ? message.text
            : "Your name was set when you signed up and can't be changed."}
        </span>
      </div>
    );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!name) return;
    // Shown back once, as at sign-up: it's for good again once changed.
    if (confirming !== name) return setConfirming(name);
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    // The profile name is what others see on your workouts and backblasts.
    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", user.id);
    if (error) {
      setPending(false);
      return setMessage({ text: error.message, error: true });
    }
    const { error: authError } = await supabase.auth.updateUser({
      // f3_name too, since signing in with Google overwrites `name`.
      data: { name, f3_name: name },
    });
    setPending(false);
    setConfirming(null);
    setMessage(
      authError
        ? { text: authError.message, error: true }
        : { text: `Your name is now ${name}.`, error: false },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p
        role="alert"
        className="rounded-xl border border-accent/60 bg-accent-soft px-3 py-2.5 text-sm text-ink"
      >
        Your name <strong>{user.name}</strong> isn&apos;t on the {region?.name}{" "}
        roster anymore. Choose your name as it&apos;s now written there.
      </p>
      <NameField
        region={region}
        userId={user.id}
        changing
        onChange={() => setConfirming(null)}
      />
      {confirming && <ConfirmName name={confirming} />}
      {message && (
        <p
          className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
        >
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : confirming
            ? `Yes, I'm ${confirming}: change my name`
            : "Change my name"}
      </button>
    </form>
  );
}
