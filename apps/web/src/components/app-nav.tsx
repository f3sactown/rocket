"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import {
  ArchiveIcon,
  CloseIcon,
  DumbbellIcon,
  HomeIcon,
  GearIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
} from "./icons";
import { RocketArt } from "./rocket-art";

const LINKS = [
  {
    href: "/",
    label: "Home",
    match: (path: string) => path === "/",
  },
  {
    href: "/workouts",
    label: "Workouts",
    match: (path: string) =>
      path === "/workouts" ||
      path === "/workouts/" ||
      path.startsWith("/workout/") ||
      path.startsWith("/workouts/edit"),
  },
  {
    href: "/workouts/new",
    label: "New workout",
    match: (path: string) => path.startsWith("/workouts/new"),
  },
  {
    href: "/backblasts",
    label: "Backblasts",
    match: (path: string) =>
      path.startsWith("/backblast/") || path.startsWith("/backblasts"),
  },
  {
    href: "/search",
    label: "Search",
    match: (path: string) => path.startsWith("/search"),
  },
  {
    href: "/archive",
    label: "Archive",
    match: (path: string) => path.startsWith("/archive"),
  },
  {
    href: "/settings",
    label: "Settings",
    match: (path: string) => path.startsWith("/settings"),
  },
];

const ICONS: Record<string, React.ReactNode> = {
  "/workouts": <DumbbellIcon />,
  "/workouts/new": <PlusIcon />,
  "/": <HomeIcon />,
  "/backblasts": "☰",
  "/search": <SearchIcon />,
  "/archive": <ArchiveIcon />,
  "/settings": <GearIcon />,
};

/** Top bar with the app name and a menu to every page. Shown only when signed in. */
export function AppNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // Close the menu on Escape or a tap outside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!user) return null;

  return (
    <nav
      aria-label="Main"
      className="relative flex items-center justify-between px-2"
      ref={menu}
    >
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink"
      >
        {/* Tilted like the app icon, heading up and to the right. */}
        <span className="flex size-9 items-center justify-center">
          <RocketArt className="h-9 w-[19px] rotate-45" />
        </span>
        Rocket
      </Link>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="app-menu"
        onClick={() => setOpen(!open)}
        className="rounded-full border border-line p-2 text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open && (
        <div
          id="app-menu"
          className="absolute top-full right-2 z-20 mt-2 flex w-60 flex-col gap-1 rounded-2xl border border-line-strong bg-surface-raised p-2 shadow-xl"
        >
          <p className="truncate px-3 py-2 text-xs text-muted">
            Signed in as {user.name}
          </p>
          {LINKS.map((link) => {
            const current = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  current
                    ? "bg-accent-soft text-ink"
                    : "text-ink-soft hover:bg-hover hover:text-ink"
                }`}
              >
                <span className={current ? "text-accent" : "text-muted"}>
                  {ICONS[link.href]}
                </span>
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              createClient().auth.signOut();
            }}
            className="mt-1 rounded-xl border-t border-line px-3 py-2.5 text-left text-sm text-muted transition-colors hover:text-accent"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
