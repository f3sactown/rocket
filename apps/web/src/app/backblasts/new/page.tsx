import { Suspense } from "react";
import { createBackblast } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export default function NewBackblastPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">New backblast</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <BackblastForm />
      </Suspense>
    </main>
  );
}

async function BackblastForm() {
  const user = await requireUser();
  return (
    <form action={createBackblast} className="flex flex-col gap-3">
      <Field label="Title" name="title" required />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Date" name="date" type="date" required />
        <Field label="AO" name="ao" required />
        <Field label="Q" name="q" required defaultValue={user.name} />
      </div>
      <Field label="PAX (comma separated)" name="pax" textarea />
      <Field label="FNGs (comma separated)" name="fngs" />
      <Field label="Warmup" name="warmup" textarea />
      <Field label="The Thang" name="thang" textarea />
      <Field label="Moleskin" name="moleskin" textarea />
      <button type="submit" className="btn self-start">
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
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {textarea ? (
        <textarea name={name} rows={4} className="input" />
      ) : (
        <input name={name} className="input" {...props} />
      )}
    </label>
  );
}
