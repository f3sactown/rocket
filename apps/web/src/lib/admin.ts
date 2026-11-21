"use client";

/**
 * The Admin page's data: whether you're an admin, everyone on Rocket, and the changes admins make
 * to people (name, region, admin), each checked and logged by the database (see the admins
 * migration). Regions are added, changed and removed directly (only admins may).
 */

import { useAuth } from "@/components/auth-provider";
import { isTakenNameError } from "./regions";
import { createClient } from "./supabase/client";
import { useLoad } from "./use-region";

const checked = new Map<string, Promise<boolean>>();

/** Whether a user is an admin (asked once per visit). */
export function isAdmin(userId: string): Promise<boolean> {
  let answer = checked.get(userId);
  if (!answer) {
    answer = Promise.resolve(createClient().rpc("is_admin")).then(
      ({ data, error }) => !error && data === true,
    );
    // Asked again next time if it couldn't be.
    answer.catch(() => checked.delete(userId));
    checked.set(userId, answer);
  }
  return answer;
}

/** Whether the signed-in user is an admin: undefined while it's being checked. */
export function useIsAdmin(): boolean | undefined {
  const userId = useAuth().user?.id;
  const result = useLoad(userId ? () => isAdmin(userId) : null, [userId]);
  return userId ? result.value : false;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  region_id: string | null;
  region_scope: string | null;
  region_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
}

/** Everyone on Rocket matching a name or email (all of them, up to 200, for a blank search). */
export async function findPeople(query: string): Promise<Person[]> {
  const { data, error } = await createClient().rpc("admin_people", {
    p_query: query,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Person[];
}

/** An admin change's error, said plainly. */
function problem(error: { code?: string; message: string }): string {
  return isTakenNameError(error)
    ? "Someone in that region on Rocket already has that name."
    : error.message;
}

/** Changes someone's name; an error message if it can't be. */
export async function setPersonName(userId: string, name: string) {
  const { error } = await createClient().rpc("admin_set_name", {
    p_user: userId,
    p_name: name,
  });
  return error ? problem(error) : null;
}

/** Changes someone's region: a region's ID, "all:f3", "all:fia", or null for none. */
export async function setPersonRegion(userId: string, region: string | null) {
  const { error } = await createClient().rpc("admin_set_region", {
    p_user: userId,
    p_region: region,
  });
  return error ? problem(error) : null;
}

/** Makes someone an admin, or not. */
export async function setPersonAdmin(userId: string, admin: boolean) {
  const { error } = await createClient().rpc("admin_set_admin", {
    p_user: userId,
    p_admin: admin,
  });
  return error ? problem(error) : null;
}

export interface LogEntry {
  id: number;
  at: string;
  admin: string | null;
  action: string;
  target: string;
  details: Record<string, unknown>;
}

/** The latest admin changes, newest first, with who made each. */
export async function loadAdminLog(limit = 50): Promise<LogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admin_log")
    .select("id, at, admin_id, action, target, details")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const ids = [
    ...new Set((data ?? []).map((e) => e.admin_id).filter(Boolean)),
  ] as string[];
  const { data: names } = ids.length
    ? await supabase.from("profiles").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string }[] };
  const byId = new Map((names ?? []).map((p) => [p.id, p.name]));
  return (data ?? []).map((e) => ({
    id: e.id,
    at: e.at,
    admin: e.admin_id ? (byId.get(e.admin_id) ?? "An admin") : null,
    action: e.action,
    target: e.target,
    details: (e.details ?? {}) as Record<string, unknown>,
  }));
}

/** A log entry in words, e.g. "Changed Casper's name (was Caspr)". */
export function describe(entry: LogEntry): string {
  const d = entry.details;
  switch (entry.action) {
    case "name_changed":
      return `Changed a name to ${entry.target}${d.from ? ` (was ${String(d.from)})` : ""}`;
    case "region_set":
      return `Set ${entry.target}'s region to ${String(d.region ?? "")}`;
    case "admin_added":
      return `Made ${entry.target} an admin`;
    case "admin_removed":
      return `Removed ${entry.target} as an admin`;
    case "region_added":
      return `Added the region ${entry.target}`;
    case "region_changed":
      return d.name && d.name !== entry.target
        ? `Changed the region ${String(d.name)} (now ${entry.target})`
        : `Changed the region ${entry.target}`;
    case "region_removed":
      return `Removed the region ${entry.target}${typeof d.people === "number" ? ` (${d.people} ${d.people === 1 ? "person" : "people"} left without a region)` : ""}`;
    default:
      return `${entry.action} ${entry.target}`;
  }
}
