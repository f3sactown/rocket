"use client";

import { termsFor, type Language } from "@rocket/core";
import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthForm } from "./auth-form";

export interface CurrentUser {
  /** Permanent unique account ID; all of a user's data is tied to this, never to their name. */
  id: string;
  name: string;
  email: string;
  /** Which vocabulary the app uses for this user (F3 or FiA). */
  language: Language;
}

const AuthContext = createContext<{
  user: CurrentUser | null;
  loading: boolean;
}>({
  user: null,
  loading: true,
});

function toCurrentUser(user: User | undefined): CurrentUser | null {
  if (!user) return null;
  const name = user.user_metadata?.name as string | undefined;
  return {
    id: user.id,
    name: name || user.email || "PAX",
    email: user.email ?? "",
    language: user.user_metadata?.language === "fia" ? "fia" : "f3",
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
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: toCurrentUser(session?.user), loading: false });
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
  return children(user);
}
