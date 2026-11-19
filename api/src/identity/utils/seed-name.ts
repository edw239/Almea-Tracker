const REPLACEMENT_CHARACTER = '\uFFFD';

/**
 * Seed names arrive from the environment. A lossy decode of Cyrillic turns
 * the UTF-8 bytes into ASCII '?' plus U+FFFD, and the seed would otherwise
 * persist that as the user's display name. Fall back when the value has no
 * letters or already contains the replacement character.
 */
export function seedDisplayName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  if (!isReadableDisplayName(trimmed)) return fallback;
  return trimmed;
}

function isReadableDisplayName(value: string): boolean {
  if (value.length === 0 || value.includes(REPLACEMENT_CHARACTER)) return false;
  return /\p{L}/u.test(value);
}
