"use client";

import { termsFor, type Language } from "@rocket/core";
import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthForm } from "./auth-form";
import { FinishProfile } from "./finish-profile";
import { syncAccent } from "./theme-switcher";

export interface CurrentUser {
  /** Permanent unique account ID; all of a user's data is tied to this, never to their name. */
  id: string;
  name: string;
  email: string;
  /** Which vocabulary the app uses for this user (F3 or FiA). */
  language: Language;
  /** The user's home region, if they've chosen one. */
  regionId: string | null;
  /** What swiping a backblast to the left does; swiping right does the other. */
  swipeLeft: SwipeAction;
  /** Which sections the Home page shows, in order. */
  homeSections: HomeSection[];
  /** Whose public workouts Discover and Trending show: F3's, FiA's or both (the default). */
  publicSources: Language[];
  /** Whether Discover includes the user's own public workouts (off by default). */
  discoverIncludeOwn: boolean;
  /** Whether Discover has already asked about including them, so it asks only once. */
  discoverOwnAsked: boolean;
  /** Whether a copied or shared backblast ends with a link to its workout (on by default). */
  shareWorkoutLink: boolean;
  /** Regions (by ID) turned off in the PAX page's From picker; all are on by default. */
  paxSourcesOff: string[];
  /** How the account signs in, e.g. ["email"], ["google"] or both. */
  providers: string[];
  /** Signed in with Google for the first time: still to give an F3 name and region. */
  needsProfile: boolean;
  /** Whether new workouts start public (the default) or private. */
  defaultWorkoutVisibility: "public" | "private";
  /** Whether new backblasts start public (the default) or private. */
  defaultBackblastVisibility: "public" | "private";
  /** When the newest signup in the PAX page's "New on Rocket" note last dismissed joined. */
  paxNewSeen: string | null;
  /** The build number whose "What's new" note on Home was last dismissed. */
  whatsNewSeen: string | null;
  /** Notices (by ID) the user chose not to show again; Settings → Notifications brings them back. */
  noticesOff: string[];
  /** Built-in templates (by name) chosen as a section's default, by section. */
  builtInDefaults: Record<string, string>;
}

function builtInDefaultsFrom(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** Both F3 and FiA, which public workouts show until the user narrows it in Settings. */
export const ALL_PUBLIC_SOURCES: Language[] = ["f3", "fia"];

function publicSourcesFrom(value: unknown): Language[] {
  if (!Array.isArray(value)) return ALL_PUBLIC_SOURCES;
  const chosen = ALL_PUBLIC_SOURCES.filter((s) => value.includes(s));
  return chosen.length ? chosen : ALL_PUBLIC_SOURCES;
}

/** The sections Home can show. */
export type HomeSection =
  | "totals"
  | "today"
  | "drafts"
  | "upcoming"
  | "trending"
  | "workouts"
  | "backblasts";

export const HOME_SECTIONS: { value: HomeSection; label: string }[] = [
  { value: "totals", label: "Posts and Qs" },
  { value: "today", label: "Today's workouts" },
  { value: "drafts", label: "Your drafts" },
  { value: "upcoming", label: "Future workouts" },
  { value: "trending", label: "Trending workouts" },
  { value: "workouts", label: "Recent workouts" },
  { value: "backblasts", label: "Recent backblasts" },
];

/** What Home shows until the user changes it in Settings. */
export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  "totals",
  "today",
  "drafts",
  "upcoming",
  "workouts",
  "backblasts",
];

/** The sections there were before choices recorded which ones the user had seen. */
const ORIGINAL_SECTIONS: HomeSection[] = [
  "totals",
  "drafts",
  "upcoming",
  "trending",
  "workouts",
  "backblasts",
];

/**
 * The sections a user's saved choice shows. A section added since they last chose (one not in
 * `seen`) shows if it's on by default, so new sections reach people who customized Home.
 */
function homeSectionsFrom(value: unknown, seen: unknown): HomeSection[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_SECTIONS;
  const seenList = Array.isArray(seen) ? seen : ORIGINAL_SECTIONS;
  return HOME_SECTIONS.map((s) => s.value).filter(
    (s) =>
      value.includes(s) ||
      (!seenList.includes(s) && DEFAULT_HOME_SECTIONS.includes(s)),
  );
}

export type SwipeAction = "delete" | "archive";

const AuthContext = createContext<{
  user: CurrentUser | null;
  loading: boolean;
}>({
  user: null,
  loading: true,
});

function toCurrentUser(user: User | undefined): CurrentUser | null {
  if (!user) return null;
  // The F3 name is kept as f3_name too, since signing in with Google overwrites `name` with the
  // name on the Google account each time.
  const name = (user.user_metadata?.f3_name ?? user.user_metadata?.name) as
    string | undefined;
  // Signed in with Google but hasn't given an F3 name and region yet (see FinishProfile).
  const providers = (user.app_metadata?.providers ?? []) as string[];
  const needsProfile =
    providers.includes("google") && !user.user_metadata?.f3_name;
  return {
    id: user.id,
    name: name || user.email || "PAX",
    needsProfile,
    providers,
    email: user.email ?? "",
    language: user.user_metadata?.language === "fia" ? "fia" : "f3",
    // Like Mail: swipe left to delete, right to archive, unless the user swapped them.
    swipeLeft:
      user.user_metadata?.swipe_left === "archive" ? "archive" : "delete",
    homeSections: homeSectionsFrom(
      user.user_metadata?.home_sections,
      user.user_metadata?.home_sections_seen,
    ),
    publicSources: publicSourcesFrom(user.user_metadata?.public_sources),
    discoverIncludeOwn: user.user_metadata?.discover_include_own === true,
    discoverOwnAsked: user.user_metadata?.discover_own_asked === true,
    shareWorkoutLink: user.user_metadata?.share_workout_link !== false,
    paxSourcesOff: Array.isArray(user.user_metadata?.pax_sources_off)
      ? (user.user_metadata.pax_sources_off as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
    defaultWorkoutVisibility:
      user.user_metadata?.default_workout_visibility === "private"
        ? "private"
        : "public",
    defaultBackblastVisibility:
      user.user_metadata?.default_backblast_visibility === "private"
        ? "private"
        : "public",
    paxNewSeen:
      typeof user.user_metadata?.pax_new_seen === "string"
        ? user.user_metadata.pax_new_seen
        : null,
    whatsNewSeen:
      typeof user.user_metadata?.whats_new_seen === "string"
        ? user.user_metadata.whats_new_seen
        : null,
    noticesOff: Array.isArray(user.user_metadata?.notices_off)
      ? (user.user_metadata.notices_off as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
    builtInDefaults: builtInDefaultsFrom(user.user_metadata?.builtin_defaults),
    regionId:
      typeof user.user_metadata?.region_id === "string"
        ? user.user_metadata.region_id
        : null,
  };
}

/** Tracks the signed-in Supabase user for the whole app. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    user: CurrentUser | null;
    loading: boolean;
  }>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setState({ user: toCurrentUser(data.session?.user), loading: false });
      if (data.session) syncAccent(data.session.user.user_metadata?.accent);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: toCurrentUser(session?.user), loading: false });
      // The accent color follows the account to every device.
      if (session) syncAccent(session.user.user_metadata?.accent);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

/** The words to show the signed-in user, in their chosen vocabulary (F3 when signed out). */
export function useTerms() {
  return termsFor(useContext(AuthContext).user?.language);
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Renders its children for a signed-in user, and the sign-in form otherwise. */
export function SignedIn({
  children,
}: {
  children: (user: CurrentUser) => React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!user) return <AuthForm />;
  if (user.needsProfile) return <FinishProfile user={user} />;
  return children(user);
}
