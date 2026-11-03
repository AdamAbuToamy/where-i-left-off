/** The active assistant uses device authorization, not a root-page OAuth callback.
 * Remove abandoned callback parameters while preserving all unrelated URL state.
 * Firebase's reserved handlers and email action links belong to Firebase.
 */
export function cleanStaleAuthorizationUrl(href: string): string | null {
  const url = new URL(href);
  if (url.pathname !== "/" && url.pathname !== "/index.html") return null;
  const params = url.searchParams;
  if (params.has("oobCode") || (params.has("mode") && params.has("apiKey")))
    return null;
  const obsoleteCallback =
    params.has("wilo_openrouter") ||
    (params.has("state") && (params.has("code") || params.has("error")));
  if (!obsoleteCallback) return null;
  for (const key of [
    "code",
    "state",
    "wilo_openrouter",
    "error",
    "error_description",
  ])
    params.delete(key);
  return url.pathname + url.search + url.hash;
}
