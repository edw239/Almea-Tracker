/**
 * Validate IANA timezone via Intl.DateTimeFormat.
 * Prefer this over supportedValuesOf: some Node/ICU builds omit UTC from the list
 * while still accepting it in DateTimeFormat options.
 */
export function isValidIanaTimezone(value: string): boolean {
  if (!value || value.length > 64) {
    return false;
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
