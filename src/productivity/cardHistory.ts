/** Compatibility only: preserve versions already saved by the retired preview.
 * No new versions are collected and no history UI/background service is mounted.
 */
export function cardHistoryFields(
  raw: Record<string, unknown> | undefined,
  ..._unused: unknown[]
) {
  void _unused;
  return raw?.versionHistory ? { versionHistory: raw.versionHistory } : {};
}
