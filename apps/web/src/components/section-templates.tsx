"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveIcon, TemplatesIcon } from "./icons";

export interface SectionTemplate {
  id: string;
  section: string;
  name: string;
  body: string;
}

/** Templates that ship with the app, offered alongside the user's own. */
export type BuiltInTemplate = Omit<SectionTemplate, "id" | "section">;

/** Save and load buttons for one backblast section, with their inline panels. */
export function SectionTemplates({
  userId,
  section,
  label,
  body,
  preview,
  templates,
  builtIns = [],
  onLoad,
  onTemplatesChange,
}: {
  userId: string;
  section: string;
  label: string;
  /** The section's current content, as stored in a template. */
  body: string;
  /** Turns a template body into a one-line preview. */
  preview?: (body: string) => string;
  templates: SectionTemplate[];
  builtIns?: BuiltInTemplate[];
  onLoad: (body: string) => void;
  onTemplatesChange: (
    update: (all: SectionTemplate[]) => SectionTemplate[],
  ) => void;
}) {
  const [mode, setMode] = useState<"save" | "load" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isEmpty = !body.trim() || body === "[]";
  const mine = templates.filter((t) => t.section === section);
  const summarize = preview ?? ((text: string) => text.trim().split("\n")[0]);

  function toggle(next: "save" | "load") {
    setMode(mode === next ? null : next);
    setError(null);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const { data, error } = await createClient()
      .from("section_templates")
      .upsert(
        { owner_id: userId, section, name: trimmed, body },
        { onConflict: "owner_id,section,name" },
      )
      .select("id, section, name, body")
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    onTemplatesChange((all) => [...all.filter((t) => t.id !== data.id), data]);
    setName("");
    setMode(null);
  }

  function load(template: BuiltInTemplate) {
    if (
      !isEmpty &&
      body !== template.body &&
      !confirm(`Replace the current ${label} text?`)
    )
      return;
    onLoad(template.body);
    setMode(null);
  }

  async function remove(template: SectionTemplate) {
    if (!confirm(`Delete the "${template.name}" template?`)) return;
    const { error } = await createClient()
      .from("section_templates")
      .delete()
      .eq("id", template.id);
    if (error) return setError(error.message);
    onTemplatesChange((all) => all.filter((t) => t.id !== template.id));
  }

  return (
    <>
      <span className="flex shrink-0 items-center gap-1">
        <IconButton
          label={`Save ${label} as a template`}
          active={mode === "save"}
          disabled={isEmpty}
          onClick={() => toggle("save")}
        >
          <SaveIcon />
        </IconButton>
        <IconButton
          label={`Load a saved ${label} template`}
          active={mode === "load"}
          onClick={() => toggle("load")}
        >
          <TemplatesIcon />
          {mine.length > 0 && (
            <span className="font-mono text-xs">{mine.length}</span>
          )}
        </IconButton>
      </span>

      {mode && (
        <div className="order-last min-w-0 basis-full rounded-xl border border-line bg-surface p-3 text-sm">
          {mode === "save" ? (
            <div className="flex gap-2">
              <input
                autoFocus
                placeholder="Template name"
                aria-label="Template name"
                list={`${section}-template-names`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                }}
                className="input min-w-0 flex-1 py-2"
              />
              <datalist id={`${section}-template-names`}>
                {mine.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={save}
                className="rounded-lg border border-line-strong px-3 font-medium text-ink transition hover:border-accent/60 disabled:opacity-40"
              >
                {busy ? "…" : "Save"}
              </button>
            </div>
          ) : mine.length + builtIns.length === 0 ? (
            <p className="text-muted">
              No saved {label} templates yet. Use the save icon to add one.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {builtIns.map((t) => (
                <TemplateRow
                  key={t.name}
                  name={t.name}
                  tag="Built-in"
                  preview={summarize(t.body)}
                  onLoad={() => load(t)}
                />
              ))}
              {mine.map((t) => (
                <TemplateRow
                  key={t.id}
                  name={t.name}
                  preview={summarize(t.body)}
                  onLoad={() => load(t)}
                  onDelete={() => remove(t)}
                />
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-accent">{error}</p>}
        </div>
      )}
    </>
  );
}

function IconButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg p-1.5 transition-colors disabled:opacity-30 ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function TemplateRow({
  name,
  tag,
  preview,
  onLoad,
  onDelete,
}: {
  name: string;
  tag?: string;
  preview: string;
  onLoad: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onLoad}
        className="flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover"
      >
        <span className="flex items-center gap-2 font-medium text-ink">
          {name}
          {tag && <span className="text-xs font-normal text-muted">{tag}</span>}
        </span>
        <span className="truncate text-muted">{preview || "—"}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete the ${name} template`}
          onClick={onDelete}
          className="link px-2 text-lg"
        >
          ×
        </button>
      )}
    </li>
  );
}
