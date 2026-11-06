"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { createClient } from "@/lib/supabase/client";

type Stage =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "invalid"; reason: string }
  | { kind: "done" };

const EXPIRED =
  "This reset link has expired or was already used. Ask for a new one from Sign in → Forgot password?";

/**
 * Where a password reset email lands. The link signs you in for the reset, then you choose a new
 * password. Supabase's standard link returns with the session in the address (#access_token…),
 * which works on any device; a one-time code (same browser) or a custom template's token_hash are
 * handled too.
 */
export default function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>({ kind: "checking" });

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const failed =
      params.get("error_description") ?? hash.get("error_description");
    // Tidy the address bar, so the one-time code isn't left in history.
    window.history.replaceState(null, "", window.location.pathname);

    (async () => {
      if (failed) return setStage({ kind: "invalid", reason: EXPIRED });
      // Supabase's standard link: the session itself, after the #.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) return setStage({ kind: "invalid", reason: EXPIRED });
        return setStage({ kind: "ready" });
      }
      const tokenHash = params.get("token_hash");
      if (tokenHash) {
        // From an email template that sends the token itself (works on any device).
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error) return setStage({ kind: "invalid", reason: EXPIRED });
        return setStage({ kind: "ready" });
      }
      // The default link's code is exchanged for a session as the client starts.
      const code = params.get("code");
      if (code) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) return setStage({ kind: "invalid", reason: EXPIRED });
        }
        return setStage({ kind: "ready" });
      }
      const { data } = await supabase.auth.getSession();
      setStage(
        data.session
          ? { kind: "ready" }
          : {
              kind: "invalid",
              reason:
                "Open this page from the link in your password reset email. To get one, go to Sign in → Forgot password?",
            },
      );
    })();
  }, []);

  return (
    <section className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">Reset password</h1>
      </header>
      {stage.kind === "checking" && (
        <p className="panel px-3 py-8 text-center text-muted">
          Checking your link…
        </p>
      )}
      {stage.kind === "invalid" && (
        <div className="flex flex-col gap-4">
          <p className="panel px-4 py-4 text-sm text-accent">{stage.reason}</p>
          <Link href="/" className="btn w-full">
            Go to sign in
          </Link>
        </div>
      )}
      {stage.kind === "ready" && (
        <NewPasswordForm onDone={() => setStage({ kind: "done" })} />
      )}
      {stage.kind === "done" && (
        <div className="flex flex-col gap-4">
          <p className="panel px-4 py-4 text-sm text-ink-soft">
            Your password is updated, and you&apos;re signed in.
          </p>
          <Link href="/" className="btn w-full">
            Go home
          </Link>
        </div>
      )}
    </section>
  );
}

function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) return setError(error.message);
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="panel flex flex-col gap-4">
        <label className="label flex flex-col gap-1.5">
          New password
          <PasswordInput
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="label flex flex-col gap-1.5">
          Confirm new password
          <PasswordInput
            name="confirm"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
