/** One release's notes from CHANGELOG.md, grouped as the changelog groups them. */
export interface ReleaseNotes {
  version: string;
  /** The release date as written in the heading (YYYY-MM-DD), or "" if it has none. */
  date: string;
  sections: { title: string; items: string[] }[];
}

/** `x.y.z` and `x.y.z-alpha.n` with regex characters escaped. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The notes for `version` from a release-please CHANGELOG.md, or null if it has no entry for it.
 * Each bullet becomes one item, its wrapped lines joined; links keep only their text, and the
 * commit and issue references release-please adds at the end of a bullet are dropped.
 */
export function releaseNotes(
  changelog: string,
  version: string,
): ReleaseNotes | null {
  const lines = changelog.split(/\r?\n/);
  const heading = new RegExp(`^##\\s+\\[?v?${escape(version)}\\]?(?![\\w.-])`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return null;
  const date = lines[start].match(/\((\d{4}-\d{2}-\d{2})\)\s*$/)?.[1] ?? "";

  const sections: ReleaseNotes["sections"] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const title = line.match(/^###\s+(.*)$/);
    const bullet = line.match(/^[*-]\s+(.*)$/);
    if (title) sections.push({ title: title[1].trim(), items: [] });
    else if (bullet) {
      if (!sections.length) sections.push({ title: "", items: [] });
      sections[sections.length - 1].items.push(bullet[1].trim());
    } else if (/^\s+\S/.test(line) && sections.at(-1)?.items.length) {
      const items = sections[sections.length - 1].items;
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }

  const clean = (item: string) =>
    item
      // release-please's trailing "([abc1234](…))" and "(#12)" references.
      .replace(/(\s*\(\[[^\]]+\]\([^)]*\)\))+\s*$/, "")
      .replace(/(\s*\(#\d+\))+\s*$/, "")
      // Links keep only their text.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .trim();
  const cleaned = sections
    .map((s) => ({ title: s.title, items: s.items.map(clean).filter(Boolean) }))
    .filter((s) => s.items.length);
  return cleaned.length ? { version, date, sections: cleaned } : null;
}
