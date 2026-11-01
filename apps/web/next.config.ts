import { execSync } from "node:child_process";
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

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPackage.version,
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
    NEXT_PUBLIC_COMMIT: commit,
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
