"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function names(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function optional(value: FormDataEntryValue | null): string | null {
  return String(value ?? "").trim() || null;
}

export async function createBackblast(form: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backblasts")
    .insert({
      author_id: user.id,
      title: String(form.get("title")).trim(),
      date: String(form.get("date")),
      ao: String(form.get("ao")).trim(),
      q: String(form.get("q")).trim(),
      pax: names(form.get("pax")),
      fngs: names(form.get("fngs")),
      warmup: optional(form.get("warmup")),
      thang: optional(form.get("thang")),
      moleskin: optional(form.get("moleskin")),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/backblasts/${data.id}`);
}
