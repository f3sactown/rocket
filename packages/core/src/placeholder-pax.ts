/**
 * Whether a name in a region's sheet is a placeholder rather than a PAX, e.g. "Site Closed
 * (Archived)", which some sheets put in the PAX column to mark when an AO stopped meeting.
 * These are left out of rosters, regulars and PAX totals.
 */
export function isPlaceholderPax(name: string): boolean {
  return /\bsite\s*closed\b/i.test(name);
}
