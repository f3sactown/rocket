import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  ACCENT_STORAGE_KEY,
  SPLASH_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

type Tables = Database["public"]["Tables"];
type WorkoutRow = Tables["workouts"]["Row"];
type BackblastRow = Tables["backblasts"]["Row"];
type TemplateRow = Tables["section_templates"]["Row"];

/** Per-device settings that travel in an export, by their localStorage key. */
export const DEVICE_KEYS = [
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  SPLASH_STORAGE_KEY,
  "rocket-run-size",
];

/** The account settings saved in the user's metadata. */
const ACCOUNT_KEYS = [
  "name",
  "language",
  "swipe_left",
  "home_sections",
  "home_sections_seen",
  "region_id",
  "public_sources",
  "discover_include_own",
  "discover_own_asked",
  "share_workout_link",
  "pax_sources_off",
] as const;

/** Everything a user owns, as written to an export file. */
export interface AccountExport {
  app: "rocket";
  format: 1;
  version: string;
  exportedAt: string;
  account: { id: string; email: string; name: string };
  settings: {
    account: Record<string, Json | undefined>;
    device: Record<string, string>;
  };
  workouts: (WorkoutRow & { notes?: string })[];
  backblasts: BackblastRow[];
  templates: TemplateRow[];
  archives: { workouts: string[]; backblasts: string[] };
  likes: string[];
}

/** Reads every row of a query, a page at a time. */
async function all<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

function readDevice(): Record<string, string> {
  const device: Record<string, string> = {};
  for (const key of DEVICE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) device[key] = value;
    } catch {
      // Storage unavailable; nothing to export from this device.
    }
  }
  return device;
}

/** Gathers the user's settings, workouts, backblasts, templates, archive and likes. */
export async function exportAccount(): Promise<AccountExport> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to export your data.");
  const id = user.id;

  const [workouts, notes, backblasts, templates, wArchives, bArchives, likes] =
    await Promise.all([
      all<WorkoutRow>((a, b) =>
        supabase
          .from("workouts")
          .select("*")
          .eq("author_id", id)
          .order("created_at")
          .range(a, b),
      ),
      all<{ workout_id: string; body: string }>((a, b) =>
        supabase
          .from("workout_notes")
          .select("workout_id, body")
          .eq("author_id", id)
          .range(a, b),
      ),
      all<BackblastRow>((a, b) =>
        supabase
          .from("backblasts")
          .select("*")
          .eq("author_id", id)
          .order("created_at")
          .range(a, b),
      ),
      all<TemplateRow>((a, b) =>
        supabase
          .from("section_templates")
          .select("*")
          .eq("owner_id", id)
          .order("name")
          .range(a, b),
      ),
      all<{ workout_id: string }>((a, b) =>
        supabase
          .from("workout_archives")
          .select("workout_id")
          .eq("user_id", id)
          .range(a, b),
      ),
      all<{ backblast_id: string }>((a, b) =>
        supabase
          .from("backblast_archives")
          .select("backblast_id")
          .eq("user_id", id)
          .range(a, b),
      ),
      all<{ workout_id: string }>((a, b) =>
        supabase
          .from("workout_likes")
          .select("workout_id")
          .eq("user_id", id)
          .range(a, b),
      ),
    ]);

  const notesById = new Map(notes.map((n) => [n.workout_id, n.body]));
  const meta = user.user_metadata ?? {};
  return {
    app: "rocket",
    format: 1,
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    exportedAt: new Date().toISOString(),
    account: { id, email: user.email ?? "", name: meta.name ?? "" },
    settings: {
      account: Object.fromEntries(
        ACCOUNT_KEYS.filter((k) => meta[k] !== undefined).map((k) => [
          k,
          meta[k],
        ]),
      ),
      device: readDevice(),
    },
    workouts: workouts.map((w) =>
      notesById.get(w.id) ? { ...w, notes: notesById.get(w.id) } : w,
    ),
    backblasts,
    templates,
    archives: {
      workouts: wArchives.map((a) => a.workout_id),
      backblasts: bArchives.map((a) => a.backblast_id),
    },
    likes: likes.map((l) => l.workout_id),
  };
}

/** Saves an export as a JSON file the user downloads. */
export function downloadExport(data: AccountExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rocket-export-${data.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads an export file, or throws a message saying why it isn't one. */
export function parseExport(text: string): AccountExport {
  let data: Partial<AccountExport>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Rocket export (it isn't JSON).");
  }
  if (data?.app !== "rocket" || data.format !== 1)
    throw new Error("That file isn't a Rocket export.");
  return {
    ...data,
    settings: {
      account: data.settings?.account ?? {},
      device: data.settings?.device ?? {},
    },
    workouts: data.workouts ?? [],
    backblasts: data.backblasts ?? [],
    templates: data.templates ?? [],
    archives: {
      workouts: data.archives?.workouts ?? [],
      backblasts: data.archives?.backblasts ?? [],
    },
    likes: data.likes ?? [],
  } as AccountExport;
}

export type Category = "workouts" | "backblasts" | "templates";

/** What to do with an imported item that matches one already here. */
export type ConflictChoice = "keep" | "replace" | "both";

export const CONFLICT_CHOICES: { value: ConflictChoice; label: string }[] = [
  { value: "keep", label: "Keep what's here" },
  { value: "replace", label: "Replace with the file's" },
  { value: "both", label: "Keep both" },
];

/** How an import lines up with the account: per category, how many are new and which conflict. */
export interface ImportPlan {
  data: AccountExport;
  counts: Record<Category, { added: number; conflicts: number }>;
  /** IDs (for templates, section and name) already here, so a conflict. */
  existing: {
    workouts: Set<string>;
    backblasts: Set<string>;
    templates: Map<string, TemplateRow>;
  };
}

const templateKey = (t: { section: string; name: string }) =>
  `${t.section}\u0000${t.name}`;

/** Compares an export with what the account has. Workouts and backblasts match by ID. */
export async function planImport(data: AccountExport): Promise<ImportPlan> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to import.");
  const [workouts, backblasts, templates] = await Promise.all([
    all<{ id: string }>((a, b) =>
      supabase
        .from("workouts")
        .select("id")
        .eq("author_id", user.id)
        .range(a, b),
    ),
    all<{ id: string }>((a, b) =>
      supabase
        .from("backblasts")
        .select("id")
        .eq("author_id", user.id)
        .range(a, b),
    ),
    all<TemplateRow>((a, b) =>
      supabase
        .from("section_templates")
        .select("*")
        .eq("owner_id", user.id)
        .range(a, b),
    ),
  ]);
  const existing = {
    workouts: new Set(workouts.map((w) => w.id)),
    backblasts: new Set(backblasts.map((b) => b.id)),
    templates: new Map(templates.map((t) => [templateKey(t), t])),
  };
  const count = (total: number, conflicts: number) => ({
    added: total - conflicts,
    conflicts,
  });
  return {
    data,
    existing,
    counts: {
      workouts: count(
        data.workouts.length,
        data.workouts.filter((w) => existing.workouts.has(w.id)).length,
      ),
      backblasts: count(
        data.backblasts.length,
        data.backblasts.filter((b) => existing.backblasts.has(b.id)).length,
      ),
      templates: count(
        data.templates.length,
        data.templates.filter((t) => existing.templates.has(templateKey(t)))
          .length,
      ),
    },
  };
}

type PgError = { code?: string; message: string } | null;

/** Whether an insert failed because the ID is taken (by another account, which we can't see). */
const isDuplicate = (error: PgError) => error?.code === "23505";
/** Whether a reference points at a row that's gone. */
const isMissingRef = (error: PgError) => error?.code === "23503";

export interface ImportOptions {
  choices: Record<Category, ConflictChoice>;
  settings: boolean;
}

export interface ImportResult {
  added: number;
  replaced: number;
  skipped: number;
  failed: string[];
}

/**
 * Brings an export into the account. Items not here are added (keeping their IDs when free);
 * matching ones follow the category's choice. References between imported items (a backblast's
 * workout, a reuse's source) follow any new IDs.
 */
export async function runImport(
  plan: ImportPlan,
  options: ImportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const supabase = createClient();
  const { data } = plan;
  const result: ImportResult = {
    added: 0,
    replaced: 0,
    skipped: 0,
    failed: [],
  };
  const total =
    data.workouts.length + data.backblasts.length + data.templates.length;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  // Old workout and backblast IDs to the IDs they have here.
  const workoutIds = new Map<string, string>();
  const backblastIds = new Map<string, string>();

  /** Inserts a row, letting the database pick the ID if the file's is taken elsewhere. */
  async function insert<T extends "workouts" | "backblasts">(
    table: T,
    row: Record<string, unknown>,
    nullable: string[],
  ): Promise<string> {
    let attempt = { ...row };
    for (let tries = 0; tries < 3; tries++) {
      const { data: inserted, error } = await supabase
        .from(table as "workouts")
        .insert(attempt as never)
        .select("id")
        .single();
      if (!error) return inserted.id;
      if (isDuplicate(error) && attempt.id) {
        delete attempt.id;
      } else if (isMissingRef(error)) {
        attempt = {
          ...attempt,
          ...Object.fromEntries(nullable.map((k) => [k, null])),
        };
      } else throw new Error(error.message);
    }
    throw new Error("Couldn't add it.");
  }

  // Workouts first, oldest first, so a reuse's source is already here.
  for (const workout of [...data.workouts].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )) {
    const {
      notes,
      author_id: _author,
      updated_at: _updated,
      ...fields
    } = workout;
    void _author;
    void _updated;
    const row = {
      ...fields,
      reused_from: fields.reused_from
        ? (workoutIds.get(fields.reused_from) ?? fields.reused_from)
        : null,
    };
    const conflict = plan.existing.workouts.has(workout.id);
    try {
      let id = workout.id;
      if (conflict && options.choices.workouts === "keep") {
        result.skipped++;
      } else if (conflict && options.choices.workouts === "replace") {
        const { id: _id, ...update } = row;
        void _id;
        const { error } = await supabase
          .from("workouts")
          .update(update as never)
          .eq("id", workout.id);
        if (error) throw new Error(error.message);
        result.replaced++;
      } else {
        const { id: _id, ...fresh } = row;
        void _id;
        id = await insert("workouts", conflict ? fresh : row, [
          "reused_from",
          "original_author_id",
        ]);
        result.added++;
        // A workout deleted here (on its own or by a reset) gets back the likes and reuses
        // others gave it. A "Keep both" copy doesn't: the original still has them.
        if (!conflict) {
          const { error } = await supabase.rpc("restore_workout_links", {
            p_old: workout.id,
            p_new: id,
          });
          if (error) throw new Error(error.message);
        }
      }
      workoutIds.set(workout.id, id);
      if (notes && !(conflict && options.choices.workouts === "keep")) {
        const { error } = await supabase
          .from("workout_notes")
          .upsert(
            { workout_id: id, body: notes },
            { onConflict: "workout_id" },
          );
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      result.failed.push(
        `Workout “${workout.title}”: ${(error as Error).message}`,
      );
    }
    tick();
  }

  for (const backblast of data.backblasts) {
    const { author_id: _author, updated_at: _updated, ...fields } = backblast;
    void _author;
    void _updated;
    const row = {
      ...fields,
      workout_id: fields.workout_id
        ? (workoutIds.get(fields.workout_id) ?? fields.workout_id)
        : null,
    };
    const conflict = plan.existing.backblasts.has(backblast.id);
    try {
      let id = backblast.id;
      if (conflict && options.choices.backblasts === "keep") {
        result.skipped++;
      } else if (conflict && options.choices.backblasts === "replace") {
        const { id: _id, ...update } = row;
        void _id;
        const { error } = await supabase
          .from("backblasts")
          .update(update as never)
          .eq("id", backblast.id);
        if (error) throw new Error(error.message);
        result.replaced++;
      } else {
        const { id: _id, ...fresh } = row;
        void _id;
        id = await insert("backblasts", conflict ? fresh : row, ["workout_id"]);
        result.added++;
      }
      backblastIds.set(backblast.id, id);
    } catch (error) {
      result.failed.push(
        `Backblast “${backblast.title}”: ${(error as Error).message}`,
      );
    }
    tick();
  }

  // Templates match by section and name, which are unique per account.
  const names = new Set(plan.existing.templates.keys());
  const defaults = new Set(
    [...plan.existing.templates.values()]
      .filter((t) => t.is_default)
      .map((t) => t.section),
  );
  for (const template of data.templates) {
    const key = templateKey(template);
    const here = plan.existing.templates.get(key);
    try {
      if (here && options.choices.templates === "keep") {
        result.skipped++;
      } else if (here && options.choices.templates === "replace") {
        const { error } = await supabase
          .from("section_templates")
          .update({ body: template.body })
          .eq("id", here.id);
        if (error) throw new Error(error.message);
        result.replaced++;
      } else {
        let name = template.name;
        for (let n = 1; names.has(templateKey({ ...template, name })); n++)
          name = `${template.name} (imported${n > 1 ? ` ${n}` : ""})`;
        // One default per section: an imported default only becomes one if there isn't one yet.
        const isDefault =
          template.is_default && !defaults.has(template.section);
        const { error } = await supabase.from("section_templates").insert({
          section: template.section,
          name,
          body: template.body,
          is_default: isDefault,
        });
        if (error) throw new Error(error.message);
        names.add(templateKey({ ...template, name }));
        if (isDefault) defaults.add(template.section);
        result.added++;
      }
    } catch (error) {
      result.failed.push(
        `Template “${template.name}”: ${(error as Error).message}`,
      );
    }
    tick();
  }

  // Archive and likes, quietly skipping any that no longer apply.
  for (const id of data.archives.workouts)
    await supabase
      .from("workout_archives")
      .insert({ workout_id: workoutIds.get(id) ?? id });
  for (const id of data.archives.backblasts)
    await supabase
      .from("backblast_archives")
      .insert({ backblast_id: backblastIds.get(id) ?? id });
  for (const id of data.likes)
    await supabase.from("workout_likes").insert({ workout_id: id });

  if (options.settings) {
    const failed = await importSettings(data.settings);
    if (failed) result.failed.push(`Settings: ${failed}`);
  }
  return result;
}

/** Applies exported settings to the account and this device; an error message if they fail. */
async function importSettings(
  settings: AccountExport["settings"],
): Promise<string | undefined> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not signed in.";
  const account = Object.fromEntries(
    Object.entries(settings.account).filter(([k]) =>
      (ACCOUNT_KEYS as readonly string[]).includes(k),
    ),
  );
  // The region may not exist here; then the profile keeps none. "All F3 (or FiA) regions" has no
  // single region on the profile.
  let regionId =
    typeof account.region_id === "string" ? account.region_id : null;
  const scope =
    regionId === "all:f3" ? "f3" : regionId === "all:fia" ? "fia" : null;
  const profile: {
    name?: string;
    region_id: string | null;
    region_scope: "f3" | "fia" | null;
  } = {
    region_id: scope ? null : regionId,
    region_scope: scope,
  };
  if (typeof account.name === "string" && account.name.trim())
    profile.name = account.name.trim();
  let { error } = await supabase
    .from("profiles")
    .update(profile)
    .eq("id", user.id);
  if (isMissingRef(error)) {
    regionId = null;
    ({ error } = await supabase
      .from("profiles")
      .update({ ...profile, region_id: null })
      .eq("id", user.id));
  }
  if (error) return error.message;
  const { error: authError } = await supabase.auth.updateUser({
    data: { ...account, region_id: regionId },
  });
  for (const key of DEVICE_KEYS) {
    try {
      const value = settings.device[key];
      if (typeof value === "string") localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      // Storage unavailable; device settings stay as they are.
    }
  }
  return authError?.message;
}

/**
 * Clears the account back to a fresh start: deletes the user's workouts, backblasts, templates,
 * archive and likes, and resets their settings here and on this device. The login and name stay.
 */
export async function resetAccount(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to reset your account.");
  const id = user.id;
  const steps = [
    () => supabase.from("workout_archives").delete().eq("user_id", id),
    () => supabase.from("backblast_archives").delete().eq("user_id", id),
    () => supabase.from("workout_likes").delete().eq("user_id", id),
    () => supabase.from("backblasts").delete().eq("author_id", id),
    // A workout's notes go with it.
    () => supabase.from("workouts").delete().eq("author_id", id),
    () => supabase.from("section_templates").delete().eq("owner_id", id),
    () =>
      supabase
        .from("profiles")
        .update({ region_id: null, region_scope: null })
        .eq("id", id),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.auth.updateUser({
    data: {
      language: null,
      swipe_left: null,
      home_sections: null,
      home_sections_seen: null,
      region_id: null,
      public_sources: null,
      discover_include_own: null,
      discover_own_asked: null,
      share_workout_link: null,
      pax_sources_off: null,
    },
  });
  if (error) throw new Error(error.message);
  for (const key of DEVICE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable; nothing to clear.
    }
  }
}
