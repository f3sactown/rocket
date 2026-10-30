"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { parseAttendees } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

function required(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optional(form: FormData, key: string): string | null {
  return String(form.get(key) ?? "").trim() || null;
}

function attendees(form: FormData) {
  try {
    return parseAttendees(JSON.parse(String(form.get("attendees") ?? "[]")));
  } catch {
    return [];
  }
}

export async function createBackblast(form: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backblasts")
    .insert({
      author_id: user.id,
      title: required(form, "title"),
      date: required(form, "date"),
      ao: required(form, "ao"),
      q: required(form, "q"),
      introduction: optional(form, "introduction"),
      warmup: optional(form, "warmup"),
      thang: optional(form, "thang"),
      attendees: attendees(form) as unknown as Json,
      announcements: optional(form, "announcements"),
      words_of_wisdom: optional(form, "wordsOfWisdom"),
      third_f: optional(form, "thirdF"),
      second_f: optional(form, "secondF"),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/backblasts/${data.id}`);
}
