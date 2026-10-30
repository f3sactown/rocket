import Link from "next/link";
import { Suspense } from "react";
import { createBackblast } from "@/app/actions";
import { ArrowIcon } from "@/components/icons";
import { requireUser } from "@/lib/auth";

export default function NewBackblastPage() {
  return (
    <>
      <Link href="/" className="link">
        ← All backblasts
      </Link>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <BackblastForm />
      </Suspense>
    </>
  );
}

async function BackblastForm() {
  const user = await requireUser();
  return (
    <form action={createBackblast} className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">New backblast</h1>
        <span className="status mt-2">Draft</span>
      </header>

      <div className="panel flex flex-col gap-4">
        <Field label="Title" name="title" required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field label="Date" name="date" type="date" required />
          <Field label="AO" name="ao" required />
          <Field label="Q" name="q" required defaultValue={user.name} />
        </div>
        <Field label="PAX" name="pax" textarea placeholder="Comma separated" />
        <Field label="FNGs" name="fngs" placeholder="Comma separated" />
      </div>

      <div className="panel flex flex-col gap-4">
        <Field label="Warmup" name="warmup" textarea />
        <Field label="The Thang" name="thang" textarea />
        <Field label="Moleskin" name="moleskin" textarea />
      </div>

      <button type="submit" className="btn w-full">
        <ArrowIcon />
        Save backblast
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  textarea,
  ...props
}: {
  label: string;
  name: string;
  textarea?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="label flex flex-col gap-1.5">
      {label}
      {textarea ? (
        <textarea
          name={name}
          rows={3}
          placeholder={props.placeholder}
          className="input"
        />
      ) : (
        <input name={name} className="input" {...props} />
      )}
    </label>
  );
}
