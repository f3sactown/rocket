"use client";

import {
  DEFAULT_INTRODUCTION,
  formatBackblast,
  paxCount,
  type Attendee,
  type Backblast,
} from "@rocket/core";
import { useState } from "react";
import { AttendanceInput } from "./attendance-input";
import { ArrowIcon } from "./icons";

const SECTIONS = [
  {
    name: "introduction",
    label: "Introduction",
    hint: "Mission statement, core principles, disclaimer and credo",
    rows: 8,
  },
  {
    name: "warmup",
    label: "Warm-o-rama",
    hint: "Stretches and warm-up for the muscle groups you'll use",
    rows: 4,
  },
  { name: "thang", label: "The Thang", hint: "The workout", rows: 8 },
] as const;

const CLOSING_SECTIONS = [
  {
    name: "announcements",
    label: "Announcements",
    hint: "Anything beyond the site Q's usual announcements",
    rows: 3,
  },
  {
    name: "wordsOfWisdom",
    label: "Words of Wisdom",
    hint: "Wisdom to bestow on the PAX today",
    rows: 3,
  },
  {
    name: "thirdF",
    label: "Third F",
    hint: "Prayer requests, special intentions or praises",
    rows: 3,
  },
  { name: "secondF", label: "Second F", hint: "Usually coffee", rows: 2 },
] as const;

type TextKey =
  (typeof SECTIONS)[number]["name"] | (typeof CLOSING_SECTIONS)[number]["name"];

export function BackblastForm({
  action,
  defaultQ,
}: {
  action: (form: FormData) => Promise<void>;
  defaultQ: string;
}) {
  const [backblast, setBackblast] = useState<Backblast>({
    title: "",
    date: "",
    ao: "",
    q: defaultQ,
    introduction: DEFAULT_INTRODUCTION,
    attendees: [],
  });
  const [showPreview, setShowPreview] = useState(false);

  const set = <K extends keyof Backblast>(key: K, value: Backblast[K]) =>
    setBackblast((current) => ({ ...current, [key]: value }));

  const textArea = ({
    name,
    label,
    hint,
    rows,
  }: {
    name: TextKey;
    label: string;
    hint: string;
    rows: number;
  }) => (
    <label key={name} className="label flex flex-col gap-1.5">
      <span>
        {label} <span className="font-normal text-muted">· {hint}</span>
      </span>
      <textarea
        name={name}
        rows={rows}
        value={backblast[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        className="input"
      />
    </label>
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

      <div className="panel flex flex-col gap-4">{SECTIONS.map(textArea)}</div>

      <div className="panel flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="label">Name-o-rama</span>
          <span className="text-sm text-ink-soft">
            Count-o-rama{" "}
            <span className="ml-1 font-mono text-lg text-ink">
              {paxCount(backblast)}
            </span>
          </span>
        </div>
        <p className="text-sm text-muted">
          The Q is counted automatically. Mark visitors with their home region,
          FNGs with who invited them, and 2.0s.
        </p>
        <AttendanceInput
          value={backblast.attendees}
          onChange={(a: Attendee[]) => set("attendees", a)}
        />
        <input
          type="hidden"
          name="attendees"
          value={JSON.stringify(backblast.attendees)}
        />
      </div>

      <div className="panel flex flex-col gap-4">
        {CLOSING_SECTIONS.map(textArea)}
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
