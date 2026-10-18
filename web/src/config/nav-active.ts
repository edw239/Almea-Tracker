/**
 * Longest-prefix wins so `/lists` does not stay active on `/lists/x` siblings.
 */
export function navPathIsActive(
  pathname: string,
  itemTo: string,
  siblingTos: readonly string[],
): boolean {
  const matches = pathname === itemTo || pathname.startsWith(`${itemTo}/`)
  if (!matches) return false

  return !siblingTos.some(
    (other) =>
      other !== itemTo &&
      other.length > itemTo.length &&
      (other === itemTo || other.startsWith(`${itemTo}/`)) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  )
}
