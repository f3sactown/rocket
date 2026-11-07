/** Lower case letters and digits only, so "F3 Dry Creek" and "f3-drycreek" compare equal. */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A region name with and without its organization prefix ("F3 DryCreek" → "drycreek"). */
function regionKeys(name: string): string[] {
  const full = squash(name);
  const bare = full.replace(/^(f3|fia)/, "");
  return bare && bare !== full ? [full, bare] : [full];
}

/** "(DR)" marks a PAX who has moved Down Range; it's the same PAX as the name without it. */
const DOWN_RANGE = new Set(["dr", "downrange"]);

/**
 * The PAX a roster name stands for: a name like "Baby Shark (Dry Creek)" is how a region lists a
 * visitor from another region, so when the part in parentheses names one of `regionNames` (with
 * or without the organization prefix, ignoring spaces, punctuation and case) it's the same PAX as
 * "Baby Shark". Likewise "Atlas (DR)" (Down Range) is "Atlas". Any other name is returned as it
 * is, trimmed. Pass only one organization's regions, and merge only within that organization, so
 * an F3 PAX is never matched with a FiA one.
 */
export function paxBaseName(name: string, regionNames: string[]): string {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.*\S)\s*\(([^()]+)\)$/);
  if (!match) return trimmed;
  if (DOWN_RANGE.has(squash(match[2]))) return match[1].trim();
  const suffix = regionKeys(match[2]);
  const known = new Set(regionNames.flatMap(regionKeys));
  return suffix.some((k) => known.has(k)) ? match[1].trim() : trimmed;
}
