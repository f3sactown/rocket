"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name")),
          })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) setError(error.message ?? "Something went wrong");
    else router.refresh();
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
      {error && <p className="text-sm text-red-600">{error}</p>}
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
