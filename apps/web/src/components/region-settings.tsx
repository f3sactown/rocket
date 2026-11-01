"use client";

import { useState } from "react";
import {
  checkRegion,
  DEFAULT_CONFIG,
  loadPaxStats,
  loadRegions,
  type Region,
  type RegionConfig,
} from "@/lib/regions";
import { sheetIdFromUrl } from "@/lib/sheets";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-region";
import { LANGUAGES, type Language } from "@rocket/core";
import { setAccent } from "./theme-switcher";
import type { CurrentUser } from "./auth-provider";

/**
 * Saves the user's home region to their profile and account, and switches their wording (F3 or
 * FiA) and accent color to the region's. They can change those again afterwards.
 */
async function chooseRegion(userId: string, region: Region | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ region_id: region?.id ?? null })
    .eq("id", userId);
  if (error) return error.message;
  // The account copy is what the app reads; updating it refreshes every screen.
  const { error: authError } = await supabase.auth.updateUser({
    data: region
      ? { region_id: region.id, language: region.language }
      : { region_id: null },
  });
  if (!authError && region) setAccent(region.language);
  return authError?.message;
}

/** Region choice, the user's totals from the region's sheet, and adding a new region. */
export function RegionSettings({ user }: { user: CurrentUser }) {
  const [version, setVersion] = useState(0);
  const regions = useLoad(() => loadRegions(version > 0), [version]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const region = regions.value?.find((r) => r.id === user.regionId) ?? null;

  async function choose(region: Region | null) {
    setSaving(true);
    setError(null);
    const message = await chooseRegion(user.id, region);
    if (message) setError(message);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="label flex flex-col gap-1.5">
        Your region
        <select
          value={user.regionId ?? ""}
          disabled={saving || !regions.value}
          onChange={(e) => {
            if (e.target.value === "__add") return setAdding(true);
            choose(regions.value?.find((r) => r.id === e.target.value) ?? null);
          }}
          className="input"
        >
          <option value="">
            {regions.value ? "None" : "Loading regions…"}
          </option>
          {regions.value?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
          <option value="__add">My region isn&apos;t listed…</option>
        </select>
      </label>
      {(error || regions.error) && (
        <p className="text-sm text-accent">{error || regions.error}</p>
      )}

      {region && (
        <p className="-mt-2 text-xs text-muted">
          {region.synced_at
            ? `Updated from the sheet every night · last ${new Date(region.synced_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
            : "Reading the sheet live until tonight's update."}
          {region.sync_error && (
            <span className="block text-accent">
              Last update failed: {region.sync_error}
            </span>
          )}
        </p>
      )}
      {region && <RegionStats region={region} name={user.name} />}

      {adding ? (
        <RegionForm
          onCancel={() => setAdding(false)}
          onSaved={async (region) => {
            setAdding(false);
            setVersion((v) => v + 1);
            await choose(region);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="link self-start"
        >
          <span className="text-accent">＋</span> Add a region
        </button>
      )}
    </div>
  );
}

/** The user's total posts and Qs, matched by their name in the region's attendance records. */
function RegionStats({ region, name }: { region: Region; name: string }) {
  const stats = useLoad(() => loadPaxStats(region, name), [region.id, name]);
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      {stats.loading && (
        <p className="text-sm text-muted">Loading your totals…</p>
      )}
      {stats.error && <p className="text-sm text-accent">{stats.error}</p>}
      {stats.value && (
        <div className="flex items-baseline gap-6">
          <span className="text-sm text-ink-soft">
            <span className="mr-1.5 font-mono text-2xl text-ink">
              {stats.value.posts}
            </span>
            posts
          </span>
          <span className="text-sm text-ink-soft">
            <span className="mr-1.5 font-mono text-2xl text-ink">
              {stats.value.qs}
            </span>
            Qs
          </span>
          <span className="ml-auto text-xs text-muted">as {name}</span>
        </div>
      )}
    </div>
  );
}

type Field = { key: string; label: string; optional?: boolean };

const SECTIONS: {
  key: keyof RegionConfig;
  title: string;
  hint: string;
  fields: Field[];
}[] = [
  {
    key: "sites",
    title: "AOs",
    hint: "The tab listing each AO (site).",
    fields: [
      { key: "ao", label: "AO name" },
      { key: "address", label: "Address" },
      { key: "location", label: "Location (e.g. park)", optional: true },
      { key: "day", label: "Day", optional: true },
      { key: "time", label: "Time", optional: true },
      { key: "retired", label: "Retired (Y = hidden)", optional: true },
    ],
  },
  {
    key: "roster",
    title: "Roster",
    hint: "The tab listing every PAX.",
    fields: [{ key: "name", label: "PAX name" }],
  },
  {
    key: "attendance",
    title: "Attendance",
    hint: "The tab with one row per PAX per workout.",
    fields: [
      { key: "date", label: "Date" },
      { key: "ao", label: "AO name" },
      { key: "pax", label: "PAX name" },
      { key: "post", label: "Post (1 per post)" },
      { key: "q", label: "Q (1 when they Q'd)" },
    ],
  },
];

/** Adds a region: its name, Google Sheet and which tabs and columns hold the data. */
function RegionForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (region: Region) => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("f3");
  const [sheet, setSheet] = useState("");
  const [config, setConfig] = useState<RegionConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const sheetId = sheetIdFromUrl(sheet);

  const update = (section: keyof RegionConfig, key: string, value: string) =>
    setConfig((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));

  async function check() {
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ text: await checkRegion(sheetId, config), error: false });
      return true;
    } catch (error) {
      setStatus({ text: (error as Error).message, error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!(await check())) return;
    setBusy(true);
    const { data, error } = await createClient()
      .from("regions")
      .insert({
        name: name.trim(),
        sheet_id: sheetId,
        language,
        config: config as unknown as Json,
      })
      .select("id, name, sheet_id, language, config, created_by")
      .single();
    setBusy(false);
    if (error)
      return setStatus({
        text: error.message.includes("duplicate")
          ? "A region with that name already exists."
          : error.message,
        error: true,
      });
    onSaved(data as unknown as Region);
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-4 rounded-2xl border border-line-strong p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">Add a region</h3>
        <p className="text-sm text-muted">
          Rocket reads the region&apos;s Google Sheet for AOs, PAX names and
          attendance. Share the sheet so anyone with the link can view it.
        </p>
      </div>
      <label className="label flex flex-col gap-1.5">
        Region name
        <input
          required
          placeholder="F3 Example"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="label">Organization</span>
        <div
          role="radiogroup"
          aria-label="Organization"
          className="inline-flex gap-1 self-start rounded-full border border-line bg-panel p-1"
        >
          {LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={language === option.value}
              onClick={() => setLanguage(option.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                language === option.value
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          Members who choose this region get its wording and color.
        </span>
      </div>
      <label className="label flex flex-col gap-1.5">
        Google Sheet link
        <input
          required
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
          className="input"
        />
      </label>

      {SECTIONS.map((section) => (
        <fieldset
          key={section.key}
          className="flex flex-col gap-3 rounded-xl border border-line p-3"
        >
          <legend className="px-1 text-sm font-semibold text-ink">
            {section.title}
          </legend>
          <p className="-mt-1 text-xs text-muted">
            {section.hint} Use the tab name and the column headers exactly as
            they appear in the sheet.
          </p>
          <label className="label flex flex-col gap-1.5">
            Tab name
            <input
              required
              value={config[section.key].sheet}
              onChange={(e) => update(section.key, "sheet", e.target.value)}
              className="input"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {section.fields.map((field) => (
              <label
                key={field.key}
                className="label flex flex-col gap-1.5 text-xs"
              >
                {field.label} column
                {field.optional && (
                  <span className="font-normal text-muted">
                    optional, leave blank if none
                  </span>
                )}
                <input
                  required={!field.optional}
                  value={
                    (config[section.key] as Record<string, string | undefined>)[
                      field.key
                    ] ?? ""
                  }
                  onChange={(e) =>
                    update(section.key, field.key, e.target.value)
                  }
                  className="input text-sm"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {status && (
        <p
          className={`text-sm ${status.error ? "text-accent" : "text-ink-soft"}`}
        >
          {status.text}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !sheetId}
          onClick={check}
          className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check sheet"}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full border border-accent/60 bg-accent-soft px-4 py-2 text-sm font-medium text-ink transition disabled:opacity-50"
        >
          Save region
        </button>
        <button type="button" onClick={onCancel} className="link">
          Cancel
        </button>
      </div>
    </form>
  );
}
