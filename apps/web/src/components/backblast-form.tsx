"use client";

import {
  DEFAULT_INTRODUCTION,
  attendeeLabel,
  formatBackblast,
  paxCount,
  type Backblast,
} from "@rocket/core";
import { useState } from "react";
import { parseAttendees } from "@/lib/backblast";
import { AttendanceInput } from "./attendance-input";
import { ArrowIcon } from "./icons";
import {
  SectionTemplates,
  type BuiltInTemplate,
  type SectionTemplate,
} from "./section-templates";

type TextKey =
  | "introduction"
  | "warmup"
  | "thang"
  | "announcements"
  | "wordsOfWisdom"
  | "thirdF"
  | "secondF";

interface TextSection {
  name: TextKey;
  label: string;
  hint: string;
  rows: number;
  builtIns?: BuiltInTemplate[];
}

const OPENING_SECTIONS: TextSection[] = [
  {
    name: "introduction",
    label: "Introduction",
    hint: "The preamble to include the mission statement, core principles, disclaimer, and credo",
    rows: 6,
    builtIns: [{ name: "F3 standard", body: DEFAULT_INTRODUCTION }],
  },
  {
    name: "warmup",
    label: "Warm-o-rama",
    hint: "Stretches and warm-up to target muscle groups the PAX will be using during the workout",
    rows: 4,
  },
  { name: "thang", label: "The Thang", hint: "The actual workout", rows: 8 },
];

const CLOSING_SECTIONS: TextSection[] = [
  {
    name: "announcements",
    label: "Announcements",
    hint: "The site Q will have the normal announcements, this is a place for any other announcements that need to be said",
    rows: 4,
  },
  {
    name: "wordsOfWisdom",
    label: "Words of Wisdom",
    hint: "The wisdom you'd like to bestow onto the PAX this day",
    rows: 3,
  },
  {
    name: "thirdF",
    label: "Third F",
    hint: "Prayer requests, special intentions, or praises",
    rows: 3,
  },
  { name: "secondF", label: "Second F", hint: "Usually coffee", rows: 2 },
];

function attendeesPreview(body: string): string {
  try {
    return parseAttendees(JSON.parse(body)).map(attendeeLabel).join(", ");
  } catch {
    return "";
  }
}

export function BackblastForm({
  action,
  userId,
  defaultQ,
  initialTemplates,
}: {
  action: (form: FormData) => Promise<void>;
  userId: string;
  defaultQ: string;
  initialTemplates: SectionTemplate[];
}) {
  const [backblast, setBackblast] = useState<Backblast>({
    title: "",
    date: "",
    ao: "",
    q: defaultQ,
    attendees: [],
  });
  const [templates, setTemplates] = useState(initialTemplates);
  const [showPreview, setShowPreview] = useState(false);

  const set = <K extends keyof Backblast>(key: K, value: Backblast[K]) =>
    setBackblast((current) => ({ ...current, [key]: value }));

  const textSection = ({ name, label, hint, rows, builtIns }: TextSection) => (
    <div key={name} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
        <label htmlFor={name} className="label min-w-0 flex-1 pt-1">
          {label}
        </label>
        <SectionTemplates
          userId={userId}
          section={name}
          label={label}
          body={backblast[name] ?? ""}
          templates={templates}
          builtIns={builtIns}
          onLoad={(body) => set(name, body)}
          onTemplatesChange={setTemplates}
        />
      </div>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={hint}
        value={backblast[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        className="input"
      />
    </div>
  );

  return (
    <form action={action} className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">New backblast</h1>
        <span className="status mt-2">Draft</span>
      </header>

      <div className="panel flex flex-col gap-4">
        <label className="label flex flex-col gap-1.5">
          Title
          <input
            name="title"
            required
            value={backblast.title}
            onChange={(e) => set("title", e.target.value)}
            className="input"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <label className="label flex flex-col gap-1.5">
            Date
            <input
              name="date"
              type="date"
              required
              value={backblast.date}
              onChange={(e) => set("date", e.target.value)}
              className="input"
            />
          </label>
          <label className="label flex flex-col gap-1.5">
            AO
            <input
              name="ao"
              required
              value={backblast.ao}
              onChange={(e) => set("ao", e.target.value)}
              className="input"
            />
          </label>
          <label className="label flex flex-col gap-1.5">
            Q
            <input
              name="q"
              required
              value={backblast.q}
              onChange={(e) => set("q", e.target.value)}
              className="input"
            />
          </label>
        </div>
      </div>

      <div className="panel flex flex-col gap-5">
        {OPENING_SECTIONS.map(textSection)}
      </div>

      <div className="panel flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
          <span className="label min-w-0 flex-1 pt-1">
            Name-o-rama{" "}
            <span
              className="font-normal text-muted"
              title="The total attendance"
            >
              · Count-o-rama{" "}
              <span className="ml-0.5 font-mono text-base text-ink">
                {paxCount(backblast)}
              </span>
            </span>
          </span>
          <SectionTemplates
            userId={userId}
            section="attendees"
            label="Name-o-rama"
            body={JSON.stringify(backblast.attendees)}
            preview={attendeesPreview}
            templates={templates}
            onLoad={(body) =>
              set("attendees", parseAttendees(JSON.parse(body)))
            }
            onTemplatesChange={setTemplates}
          />
        </div>
        <p className="text-sm text-muted">
          The names of the PAX who attended. The Q is counted automatically.
          Mark visitors with their home region, FNGs with who invited them, and
          2.0s.
        </p>
        <AttendanceInput
          value={backblast.attendees}
          onChange={(a) => set("attendees", a)}
        />
        <input
          type="hidden"
          name="attendees"
          value={JSON.stringify(backblast.attendees)}
        />
      </div>

      <div className="panel flex flex-col gap-5">
        {CLOSING_SECTIONS.map(textSection)}
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="link self-start"
        >
          {showPreview ? "Hide preview" : "Preview what gets copied"}
        </button>
        {showPreview && (
          <pre className="panel overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
            {formatBackblast(backblast)}
          </pre>
        )}
      </div>

      <button type="submit" className="btn w-full">
        <ArrowIcon />
        Save backblast
      </button>
    </form>
  );
}
