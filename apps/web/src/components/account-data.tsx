"use client";

import { useRef, useState } from "react";
import {
  CONFLICT_CHOICES,
  downloadExport,
  exportAccount,
  parseExport,
  planImport,
  resetAccount,
  runImport,
  type Category,
  type ConflictChoice,
  type ImportPlan,
  type ImportResult,
} from "@/lib/account-data";

const BUTTON =
  "rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "workouts", label: "Workouts" },
  { value: "backblasts", label: "Backblasts" },
  { value: "templates", label: "Saved templates" },
];

/** Export, import and reset of everything the user has. */
export function AccountData() {
  return (
    <div className="flex flex-col gap-6">
      <ExportData />
      <ImportData />
      <ResetAccount />
    </div>
  );
}

function ExportData() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();

  async function run() {
    setPending(true);
    setMessage(undefined);
    try {
      const data = await exportAccount();
      downloadExport(data);
      setMessage({
        text: `Exported ${data.workouts.length} workouts, ${data.backblasts.length} backblasts and ${data.templates.length} templates.`,
        error: false,
      });
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="label">Export</span>
      <p className="text-sm text-muted">
        Download a file with your settings, workouts (with their private notes),
        backblasts, saved templates, archive and likes.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className={BUTTON}
        >
          {pending ? "Exporting…" : "Export my data"}
        </button>
        {message && (
          <p
            className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

function ImportData() {
  const input = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<Category, ConflictChoice>>({
    workouts: "keep",
    backblasts: "keep",
    templates: "keep",
  });
  const [settings, setSettings] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function choose(file: File | undefined) {
    setPlan(null);
    setResult(null);
    setError(null);
    if (!file) return;
    try {
      setPlan(await planImport(parseExport(await file.text())));
    } catch (error) {
      setError((error as Error).message);
    }
    if (input.current) input.current.value = "";
  }

  async function run() {
    if (!plan) return;
    setProgress([0, 1]);
    setError(null);
    try {
      const done = await runImport(plan, { choices, settings }, (d, t) =>
        setProgress([d, t]),
      );
      setResult(done);
      setPlan(null);
      // New settings (theme, accent and the rest) apply everywhere after a reload.
      if (settings && !done.failed.length) window.location.reload();
    } catch (error) {
      setError((error as Error).message);
    }
    setProgress(null);
  }

  const conflicts = plan
    ? CATEGORIES.filter((c) => plan.counts[c.value].conflicts > 0)
    : [];

  return (
    <div className="flex flex-col gap-2">
      <span className="label">Import</span>
      <p className="text-sm text-muted">
        Bring back an export. You&apos;ll see what&apos;s new and choose what
        happens to anything you already have.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${BUTTON} cursor-pointer`}>
          Choose export file…
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}

      {plan && (
        <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <p className="text-sm text-ink-soft">
            From {plan.data.account.name || plan.data.account.email}, exported{" "}
            {new Date(plan.data.exportedAt).toLocaleString()}.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {CATEGORIES.map((c) => (
              <li key={c.value} className="flex justify-between gap-3">
                <span className="text-ink">{c.label}</span>
                <span className="text-ink-soft">
                  {plan.counts[c.value].added} new
                  {plan.counts[c.value].conflicts > 0 &&
                    ` · ${plan.counts[c.value].conflicts} already here`}
                </span>
              </li>
            ))}
          </ul>

          {conflicts.map((c) => (
            <fieldset key={c.value} className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium text-ink">
                {c.label} already here
              </legend>
              <div className="flex flex-wrap gap-2">
                {CONFLICT_CHOICES.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      choices[c.value] === option.value
                        ? "border-accent/60 bg-accent-soft text-ink"
                        : "border-line text-ink-soft hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`conflict-${c.value}`}
                      value={option.value}
                      checked={choices[c.value] === option.value}
                      onChange={() =>
                        setChoices({ ...choices, [c.value]: option.value })
                      }
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={settings}
              onChange={(e) => setSettings(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            Also replace my settings with the file&apos;s
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={progress !== null}
              className={BUTTON}
            >
              {progress ? `Importing… ${progress[0]}/${progress[1]}` : "Import"}
            </button>
            <button
              type="button"
              onClick={() => setPlan(null)}
              disabled={progress !== null}
              className="link"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-ink-soft">
            Imported: {result.added} added, {result.replaced} replaced,{" "}
            {result.skipped} kept as they were.
          </p>
          {result.failed.map((f) => (
            <p key={f} className="text-accent">
              {f}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ResetAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      await resetAccount();
      // Everything on screen was the old data; start the app over.
      window.location.reload();
    } catch (error) {
      setError((error as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="label">Reset account</span>
      <p className="text-sm text-muted">
        Start over: deletes all your workouts, backblasts, saved templates,
        archive and likes, and puts your settings back to the defaults. You stay
        signed in with the same login and name. Export first if you might want
        any of it back.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${BUTTON} self-start text-accent`}
        >
          Reset account…
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-accent/40 p-4">
          <label className="flex flex-col gap-1.5 text-sm text-ink">
            Type RESET to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="input"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={typed.trim() !== "RESET" || pending}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
            >
              {pending ? "Resetting…" : "Reset everything"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              disabled={pending}
              className="link"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      )}
    </div>
  );
}
