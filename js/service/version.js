// Protocol version fallback, so a page newer than the service still works.

/**
 * The version to retry with after the service refused ours: the highest one the service lists
 * that is below the one just refused (so a retry never repeats itself or goes up). Null if none.
 * @param {unknown} supported  `supported` from the `unsupported_version` error
 * @param {number} refused     the version that was refused
 * @returns {number | null}
 */
export function fallbackVersion(supported, refused) {
  if (!Array.isArray(supported)) return null;
  const lower = supported.filter((v) => Number.isInteger(v) && v >= 1 && v < refused);
  return lower.length ? Math.max(...lower) : null;
}
