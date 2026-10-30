"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <h2 className="text-xl font-semibold">
        {mode === "sign-in" ? "Sign in" : "Create an account"}
      </h2>
      {mode === "sign-up" && (
        <input name="name" required placeholder="F3 name" className="input" />
      )}
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        className="input"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Password"
        className="input"
      />
      {message && (
        <p
          className={`text-sm ${message.error ? "text-red-600" : "text-green-600"}`}
        >
          {message.text}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn">
        {pending ? "…" : mode === "sign-in" ? "Sign in" : "Sign up"}
      </button>
      <button
        type="button"
        className="text-sm underline"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in"
          ? "Need an account? Sign up"
          : "Have an account? Sign in"}
      </button>
    </form>
  );
}
