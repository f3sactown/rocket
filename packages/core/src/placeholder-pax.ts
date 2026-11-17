/**
 * Whether a name in a region's sheet is left out rather than shown as a PAX: a placeholder such as
 * "Site Closed (Archived)", which some sheets put in the PAX column to mark when an AO stopped
 * meeting, or a PAX marked retired, e.g. "007 (Retired)". These are left out of rosters, regulars,
 * PAX totals and the names to choose at sign-up.
 */
export function isPlaceholderPax(name: string): boolean {
  return /\bsite\s*closed\b/i.test(name) || /\(\s*retired\s*\)/i.test(name);
}
