"use client";

import Link from "next/link";
import { useState } from "react";
import { LANGUAGES, termsFor, type Language } from "@rocket/core";
import {
  SignedIn,
  useTerms,
  type CurrentUser,
} from "@/components/auth-provider";
import { RegionSettings } from "@/components/region-settings";
import { AccentPicker, ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
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

  async function saveName(): Promise<Result> {
    const trimmed = name.trim();
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
      data: { name: trimmed },
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
        description={`Your ${terms.org} name is shown on the backblasts you write.`}
        save={saveName}
      >
        <label className="label flex flex-col gap-1.5">
          {terms.org} name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </label>
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
          <input
            type="password"
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
          <input
            type="password"
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
        title="Language"
        description="Which words the app uses, e.g. Warm-o-rama or Warm-up. Saved to your account."
      >
        <LanguagePicker language={user.language} />
      </Section>

      <Section title="Appearance" description="Saved on this device.">
        <div className="flex flex-col gap-2">
          <span className="label">Theme</span>
          <ThemeSwitcher />
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">Accent color</span>
          <AccentPicker />
        </div>
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

/** F3 / FiA choice, saved to the account so it follows the user to every device. */
function LanguagePicker({ language }: { language: Language }) {
  const [pending, setPending] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = pending ?? language;

  async function choose(value: Language) {
    if (value === language) return;
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
        aria-label="Language"
        className="inline-flex gap-1 self-start rounded-full border border-line bg-panel p-1"
      >
        {LANGUAGES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected === option.value}
            disabled={pending !== null}
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
      <p className="text-xs text-muted">
        {(() => {
          const t = termsFor(selected);
          return `${t.warmup} · ${t.thang} · ${t.thirdF} · ${t.secondF}`;
        })()}
      </p>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
