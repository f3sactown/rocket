"use server";

import { backblast } from "@rocket/db/schema";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const [created] = await db
    .insert(backblast)
    .values({
      authorId: user.id,
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
    .returning({ id: backblast.id });
  redirect(`/backblasts/${created.id}`);
}
