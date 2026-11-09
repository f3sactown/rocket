/** One release in CHANGELOG.md, grouped as the changelog groups it (Features, Bug Fixes, …). */
export interface Release {
  version: string;
  /** The release date as written in its heading (YYYY-MM-DD), or "" if it has none. */
  date: string;
  sections: { title: string; items: string[] }[];
}

/** An item without the commit links release-please adds, with its links kept as plain text. */
function clean(item: string): string {
  return (
    item
      // Trailing "([abc1234](…))" commit references and "(#12)" pull requests.
      .replace(/(\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\))+\s*$/i, "")
      .replace(/(\s*\(#\d+\))+\s*$/, "")
      // Links keep only their text.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .trim()
  );
}

/**
 * Every release in a release-please CHANGELOG.md, newest first as the file lists them. Each
 * bullet is one item, its wrapped lines joined; commit links are dropped, and an item listed
 * twice (release-please lists a change once for its commit and again for its merge) appears once.
 */
export function parseChangelog(changelog: string): Release[] {
  const releases: Release[] = [];
  let current: Release | null = null;
  for (const line of changelog.split(/\r?\n/)) {
    const heading = line.match(/^##\s+\[?v?([0-9][^\]\s)]*)\]?/);
    if (heading && !line.startsWith("###")) {
      current = {
        version: heading[1]!,
        date: line.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/)?.[1] ?? "",
        sections: [],
      };
      releases.push(current);
      continue;
    }
    if (!current) continue;
    const title = line.match(/^###\s+(.*)$/);
    const bullet = line.match(/^[*-]\s+(.*)$/);
    const sections = current.sections;
    if (title) sections.push({ title: title[1]!.trim(), items: [] });
    else if (bullet) {
      if (!sections.length) sections.push({ title: "", items: [] });
      sections[sections.length - 1]!.items.push(bullet[1]!.trim());
    } else if (/^\s+\S/.test(line) && sections.at(-1)?.items.length) {
      const items = sections[sections.length - 1]!.items;
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }
  return releases.map((release) => ({
    ...release,
    sections: release.sections
      .map((section) => {
        const seen = new Set<string>();
        const items = section.items.map(clean).filter((item) => {
          const key = item.toLowerCase();
          if (!item || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return { title: section.title, items };
      })
      .filter((section) => section.items.length),
  }));
}
