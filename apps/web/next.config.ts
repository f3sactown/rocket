import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";
import rootPackage from "../../package.json" with { type: "json" };

// Served from GitHub Pages as a static site, e.g. https://<owner>.github.io/<repo>/.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Runs a git command, or returns "" outside a git checkout. */
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

// The build number is the number of commits, so it goes up by one with every commit.
// (CI checks out the full history for this; see .github/workflows/pages.yml.)
const buildNumber = git("rev-list --count HEAD");
const commit = git("rev-parse --short HEAD");

/**
 * This version's entry in CHANGELOG.md (its heading down to the next release's), for Home's
 * one-time "What's new" note; the app parses it with `releaseNotes` from @rocket/core.
 */
function changelogEntry(version: string): string {
  try {
    const changelog = readFileSync(
      new URL("../../CHANGELOG.md", import.meta.url),
      "utf8",
    );
    const start = changelog.search(
      new RegExp(
        `^## \\[?v?${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "m",
      ),
    );
    if (start < 0) return "";
    const next = changelog.slice(start + 3).search(/^## /m);
    return next < 0
      ? changelog.slice(start)
      : changelog.slice(start, start + 3 + next);
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPackage.version,
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
    NEXT_PUBLIC_COMMIT: commit,
    NEXT_PUBLIC_RELEASE_NOTES: changelogEntry(rootPackage.version),
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
