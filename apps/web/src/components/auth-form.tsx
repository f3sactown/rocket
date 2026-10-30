"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowIcon } from "./icons";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();
    setPending(true);
    setMessage(null);

    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: String(form.get("name")).trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
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
    router.refresh();
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
          <label className="label flex flex-col gap-1.5">
            F3 name
            <input name="name" required className="input" />
          </label>
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
