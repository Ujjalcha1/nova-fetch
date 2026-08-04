/**
 * Semantic version comparison.
 *
 * Compares dot-separated numeric versions such as "1.0.0", "1.0.1", "1.2.0",
 * and "2.0.0". A leading "v" (or "V") is ignored, so "v1.0.0" equals "1.0.0".
 * Segments are compared numerically — "1.0.10" is greater than "1.0.2" — and
 * missing trailing segments are treated as 0, so "1.0" equals "1.0.0".
 *
 * The module is pure and has no Electron dependency.
 */

const LEADING_V_PATTERN = /^[vV]/

/** Parse a version string into numeric segments, ignoring a leading "v". */
export function parseVersionSegments(version: string): number[] {
  return version
    .trim()
    .replace(LEADING_V_PATTERN, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0)
}

/**
 * Compare two versions.
 * Returns -1 when a < b, 0 when a == b, 1 when a > b.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersionSegments(a)
  const pb = parseVersionSegments(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/** True when a is newer than b (a > b). */
export function isVersionGreaterThan(a: string, b: string): boolean {
  return compareVersions(a, b) > 0
}

/** True when a is older than b (a < b). */
export function isVersionLessThan(a: string, b: string): boolean {
  return compareVersions(a, b) < 0
}

/** True when a and b are the same version (a == b). */
export function isVersionEqual(a: string, b: string): boolean {
  return compareVersions(a, b) === 0
}
