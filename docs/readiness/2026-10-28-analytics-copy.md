# Analytics cache notice removal — 2026-10-28

Remove the cached/incomplete-data paragraph from Analytics in all languages, rather than rendering it conditionally during synchronization. Remove unused metadata destructuring only. Statistics, session history, caching, account isolation and synchronization are unchanged; no data migration or account writes.

Run local lint, TypeScript, production build/credential checks and relevant existing analytics tests. Required exact-head CI and production deployment results are recorded on the release PR. No new tests are added for this small presentation-only deletion. Production verification is read-only; physical-device/provider behavior is outside this change. Reverting restores the paragraph only.
