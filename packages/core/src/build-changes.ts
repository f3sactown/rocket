/** Conventional Commit types that change something people using the app would notice. */
const USER_FACING = new Set(["feat", "fix", "perf"]);

/**
 * The changes in one build, from its commits' subject lines (one per line, as `git log
 * --format=%s` gives them): only features, fixes and performance work, with the
 * `feat(scope)!:` prefix dropped and the first letter capitalized, without repeats.
 */
export function buildChanges(subjects: string): string[] {
  const changes: string[] = [];
  for (const line of subjects.split(/\r?\n/)) {
    const match = line.trim().match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/);
    if (!match || !USER_FACING.has(match[1].toLowerCase())) continue;
    const text = match[2].trim();
    const change = text.charAt(0).toUpperCase() + text.slice(1);
    if (!changes.includes(change)) changes.push(change);
  }
  return changes;
}
