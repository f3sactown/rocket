#!/usr/bin/env node
/**
 * After `next build`: lists every file of the built site in out/precache.json, for the service
 * worker to keep on the phone when this version installs, so every screen opens offline, all of
 * one version (see public/sw.js). Pages are listed by their address ("about/"), not their file.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const SKIP = new Set(["sw.js", "precache.json", "404.html", "404/index.html"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(OUT)
  .map((path) => relative(OUT, path).split(sep).join("/"))
  .filter((file) => !SKIP.has(file) && !file.startsWith("_not-found/"))
  .map((file) =>
    file === "index.html"
      ? ""
      : file.endsWith("/index.html")
        ? file.slice(0, -"index.html".length)
        : file,
  )
  .sort();

writeFileSync(join(OUT, "precache.json"), JSON.stringify({ files }));
console.log(`precache.json: ${files.length} files`);
