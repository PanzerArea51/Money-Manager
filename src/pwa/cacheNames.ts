export function cacheName(prefix: string, version: string): string {
  return `${prefix}-${version}`;
}

/** Canonical lowercase cache prefix derived from the repository name. */
export function cachePrefix(repoName: string): string {
  return repoName.toLowerCase();
}

/** Names that belong to this app (start with `${prefix}-`) and differ from `current`. */
export function staleCacheNames(
  allNames: readonly string[],
  prefix: string,
  current: string,
): string[] {
  const own = `${prefix}-`;
  return allNames.filter((name) => name.startsWith(own) && name !== current);
}
