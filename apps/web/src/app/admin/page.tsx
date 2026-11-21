"use client";

import { LANGUAGES, termsFor } from "@rocket/core";
import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { RegionForm } from "@/components/region-settings";
import { parseExport } from "@/lib/account-data";
import {
  describe,
  exportPerson,
  findPeople,
  importPerson,
  loadAdminLog,
  removePerson,
  setPersonAdmin,
  setPersonName,
  setPersonRegion,
  useIsAdmin,
  type Person,
} from "@/lib/admin";
import { loadRegions, regionColors, type Region } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-region";

export default function AdminPage() {
  return <SignedIn>{(user) => <Admin user={user} />}</SignedIn>;
}

const button =
  "rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50";

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "never";

/**
 * Rocket's Admin page, for admins only (see lib/admin.ts): People (names, regions, admins),
 * Regions (add, change, remove) and the log of every admin change.
 */
function Admin({ user }: { user: CurrentUser }) {
  const admin = useIsAdmin();
  // Bumped after a change, so the lists and the log load again.
  const [changes, setChanges] = useState(0);
  const changed = () => setChanges((n) => n + 1);
  // Bumped when only the log needs loading again (an export or import), so open entries stay.
  const [logged, setLogged] = useState(0);
  const noted = () => setLogged((n) => n + 1);

  if (admin === undefined)
    return <section className="card h-64 animate-pulse" />;
  if (!admin)
    return (
      <section className="card">
        <h1 className="card-title">Admins only</h1>
        <p className="text-ink-soft">
          This page is for Rocket&apos;s admins. Ask an admin if you need
          something changed.
        </p>
      </section>
    );
  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Admin</h1>
        <p className="text-sm text-muted">
          Change people&apos;s names and regions, manage regions and admins.
          Every change is logged below.
        </p>
      </header>
      <People
        userId={user.id}
        changes={changes}
        onChange={changed}
        onLogged={noted}
      />
      <Regions changes={changes} onChange={changed} />
      <Log changes={changes + logged} />
    </section>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Everyone on Rocket, searched by name or email, each with what an admin can change. */
function People({
  userId,
  changes,
  onChange,
  onLogged,
}: {
  userId: string;
  changes: number;
  onChange: () => void;
  onLogged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  // Searched a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const people = useLoad(() => findPeople(search), [search, changes]);
  const regions = useLoad(() => loadRegions(true), [changes]);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Section
      title="People"
      hint="Search by name or email. A change shows on their phone the next time Rocket refreshes their sign-in (within an hour) or they sign in again."
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name or email"
        aria-label="Search people"
        className="input"
      />
      {people.error && <p className="text-sm text-accent">{people.error}</p>}
      {people.loading && !people.value && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {people.value && people.value.length === 0 && (
        <p className="text-sm text-muted">No one matches.</p>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {people.value?.map((person) => (
          <li key={person.id} className="py-2">
            <button
              type="button"
              onClick={() => setOpen(open === person.id ? null : person.id)}
              aria-expanded={open === person.id}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-ink">
                  {person.name}
                  {person.id === userId && (
                    <span className="text-muted"> (you)</span>
                  )}
                </span>
                <span className="truncate text-sm text-muted">
                  {person.email} · {regionLabel(person)}
                </span>
              </span>
              {person.is_admin && (
                <span className="status shrink-0 text-xs">Admin</span>
              )}
            </button>
            {open === person.id && (
              <PersonEditor
                person={person}
                regions={regions.value ?? []}
                isYou={person.id === userId}
                onChange={onChange}
                onLogged={onLogged}
              />
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function regionLabel(person: Person): string {
  if (person.region_name) return person.region_name;
  if (person.region_scope)
    return `All ${termsFor(person.region_scope).org} regions`;
  return "No region";
}

/** One person's name, region and admin status, each changed on its own. */
function PersonEditor({
  person,
  regions,
  isYou,
  onChange,
  onLogged,
}: {
  person: Person;
  regions: Region[];
  isYou: boolean;
  onChange: () => void;
  onLogged: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [region, setRegion] = useState(
    person.region_id ??
      (person.region_scope ? `all:${person.region_scope}` : ""),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  async function run(change: () => Promise<string | null>, done: string) {
    setBusy(true);
    setMessage(null);
    const error = await change();
    setBusy(false);
    setMessage(
      error ? { text: error, error: true } : { text: done, error: false },
    );
    if (!error) onChange();
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line p-3">
      <p className="text-xs text-muted">
        Joined {date(person.created_at)} · last signed in{" "}
        {date(person.last_sign_in_at)}
      </p>
      <label className="label flex flex-col gap-1.5">
        Name
        <span className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={busy || !name.trim() || name.trim() === person.name}
            onClick={() =>
              run(
                () => setPersonName(person.id, name),
                `Name changed to ${name.trim()}.`,
              )
            }
            className={button}
          >
            Save
          </button>
        </span>
      </label>
      <label className="label flex flex-col gap-1.5">
        Region
        <span className="flex gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="input min-w-0 flex-1"
          >
            <option value="">No region</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            {LANGUAGES.map((l) => (
              <option key={l.value} value={`all:${l.value}`}>
                All {termsFor(l.value).org} regions
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={
              busy ||
              region ===
                (person.region_id ??
                  (person.region_scope ? `all:${person.region_scope}` : ""))
            }
            onClick={() =>
              run(
                () => setPersonRegion(person.id, region || null),
                "Region changed.",
              )
            }
            className={button}
          >
            Save
          </button>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {person.is_admin ? (
          <button
            type="button"
            disabled={busy || isYou}
            title={
              isYou ? "Another admin can remove you; you can't." : undefined
            }
            onClick={() => {
              if (confirm(`Remove ${person.name} as an admin?`))
                void run(
                  () => setPersonAdmin(person.id, false),
                  `${person.name} is no longer an admin.`,
                );
            }}
            className={button}
          >
            Remove as admin
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  `Make ${person.name} an admin? They'll be able to change anyone's name and region, manage regions and make other admins.`,
                )
              )
                void run(
                  () => setPersonAdmin(person.id, true),
                  `${person.name} is now an admin.`,
                );
            }}
            className={button}
          >
            Make admin
          </button>
        )}
      </div>
      <PersonData
        person={person}
        isYou={isYou}
        onRemoved={onChange}
        onLogged={onLogged}
      />
      {message && (
        <p
          className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/**
 * Someone's data: export it (the same file as Settings → Your data), import a file into their
 * account (adding what isn't there; their settings too if ticked), or remove them from Rocket.
 */
function PersonData({
  person,
  isYou,
  onRemoved,
  onLogged,
}: {
  person: Person;
  isYou: boolean;
  onRemoved: () => void;
  onLogged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [withSettings, setWithSettings] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  async function exportData() {
    setBusy(true);
    setMessage(null);
    const error = await exportPerson(person);
    setBusy(false);
    setMessage(
      error
        ? { text: error, error: true }
        : { text: "Their data is downloading.", error: false },
    );
    if (!error) onLogged();
  }

  async function importData(file: File) {
    setMessage(null);
    let data;
    try {
      data = parseExport(await file.text());
    } catch (error) {
      return setMessage({ text: (error as Error).message, error: true });
    }
    if (
      !confirm(
        `Import ${file.name} into ${person.name}'s account? What isn't there is added; what's already theirs stays as it is.${withSettings ? " Their settings, name and region come from the file too." : ""}`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await importPerson(person.id, data, withSettings);
      setMessage({
        text: `Imported: ${result.added} added, ${result.kept} already there.${
          result.failed.length
            ? ` ${result.failed.length} couldn't be: ${result.failed.join("; ")}`
            : ""
        }`,
        error: result.failed.length > 0,
      });
      onLogged();
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    }
    setBusy(false);
  }

  async function remove() {
    const typed = prompt(
      `Remove ${person.name} from Rocket? Their account and everything they made (workouts, backblasts, templates, likes) is deleted, and can't be brought back except from an export. Type REMOVE to confirm.`,
    );
    if (typed?.trim().toUpperCase() !== "REMOVE") return;
    setBusy(true);
    setMessage(null);
    const error = await removePerson(person.id);
    setBusy(false);
    if (error) setMessage({ text: error, error: true });
    else onRemoved();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <span className="label">Their data</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={exportData}
          className={button}
        >
          Export
        </button>
        <label className={`${button} cursor-pointer`}>
          Import…
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importData(file);
            }}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={withSettings}
          onChange={(e) => setWithSettings(e.target.checked)}
        />
        Import their settings, name and region too
      </label>
      {!isYou && !person.is_admin && (
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="link self-start text-sm hover:text-accent"
        >
          Remove from Rocket…
        </button>
      )}
      {message && (
        <p
          className={`text-sm ${message.error ? "text-accent" : "text-ink-soft"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/** How many people have each region (from everyone's profiles). */
async function peoplePerRegion(): Promise<Map<string, number>> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("region_id")
    .not("region_id", "is", null);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? [])
    counts.set(row.region_id!, (counts.get(row.region_id!) ?? 0) + 1);
  return counts;
}

/** Every region: add one, change one, or remove one. */
function Regions({
  changes,
  onChange,
}: {
  changes: number;
  onChange: () => void;
}) {
  const regions = useLoad(() => loadRegions(true), [changes]);
  const counts = useLoad(peoplePerRegion, [changes]);
  // Each region's color, as on the Exicon and PAX pages.
  const colors = regionColors(regions.value ?? []);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(region: Region) {
    const people = counts.value?.get(region.id) ?? 0;
    if (
      !confirm(
        `Remove ${region.name}? ${
          people
            ? `${people} ${people === 1 ? "person has" : "people have"} it as their region and will be asked to choose another.`
            : "No one has it as their region."
        } Their workouts and backblasts aren't touched.`,
      )
    )
      return;
    setError(null);
    const { error } = await createClient()
      .from("regions")
      .delete()
      .eq("id", region.id);
    if (error) setError(error.message);
    else onChange();
  }

  return (
    <Section
      title="Regions"
      hint="Only admins add, change or remove regions. A new region's sheet is read live until the nightly sync copies it."
    >
      {(regions.error || error) && (
        <p className="text-sm text-accent">{regions.error || error}</p>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {regions.value?.map((region) => (
          <li key={region.id} className="flex flex-col gap-2 py-2">
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: colors.get(region.id) }}
                    title="Its color on the Exicon and PAX pages"
                    aria-hidden
                  />
                  {region.name}
                </span>
                <span className="text-sm text-muted">
                  {termsFor(region.language).org} ·{" "}
                  {counts.value?.get(region.id) ?? 0} on Rocket ·{" "}
                  {region.synced_at
                    ? `synced ${date(region.synced_at)}`
                    : "not synced yet"}
                </span>
                {region.sync_error && (
                  <span className="text-sm text-accent">
                    Last sync failed: {region.sync_error}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setEditing(editing === region.id ? null : region.id)
                  }
                  className="link text-sm"
                >
                  {editing === region.id ? "Close" : "Change"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(region)}
                  className="link text-sm hover:text-accent"
                >
                  Remove
                </button>
              </span>
            </div>
            {editing === region.id && (
              <RegionForm
                region={region}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  onChange();
                }}
              />
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <RegionForm
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="link self-start"
        >
          <span className="text-accent">＋</span> Add a region
        </button>
      )}
    </Section>
  );
}

/** The latest admin changes, newest first. */
function Log({ changes }: { changes: number }) {
  const log = useLoad(() => loadAdminLog(), [changes]);
  return (
    <Section title="Activity" hint="Every admin change: who made it and when.">
      {log.error && <p className="text-sm text-accent">{log.error}</p>}
      {log.value && log.value.length === 0 && (
        <p className="text-sm text-muted">No changes yet.</p>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {log.value?.map((entry) => (
          <li key={entry.id} className="flex flex-col py-2 text-sm">
            <span className="text-ink">{describe(entry)}</span>
            <span className="text-xs text-muted">
              {entry.admin ?? "Rocket"} ·{" "}
              {new Date(entry.at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
