# Verification — 12 October 2026

Executed against the updated source:

| Check | Result |
|---|---|
| TypeScript + production Vite build | Passed |
| ESLint | Passed |
| Vitest unit + real Firestore emulator | 9 tests passed |
| Playwright + Authentication/Firestore emulators | 2 tests passed |

The Firestore tests exercise owner CRUD, collection reads, denied reads/writes/deletes by another UID and an anonymous client, invalid fields/types/lengths/revisions/timestamps, a live second-session subscription and rejection of stale edits/deletes.

The browser tests use isolated browser contexts with the same account, including a 390px phone viewport and crypto.randomUUID disabled. They cover project creation, edit synchronization, activation with the original orange button color, keyboard reordering and persistence after reload, custom delete confirmation/cancel/delete, a second account's empty workspace, language changes with form draft retention, search, offline write controls and viewport overflow.

Environment: Node 24, Java 17, Firebase CLI 14, Chromium 153 through Playwright. The normal Playwright browser download was unavailable in the runner, so the installed Chromium executable was supplied using TEST_CHROMIUM_PATH. The project defaults to normal Playwright Chromium on your machine.

Not verified: live Google OAuth against your Firebase project, your production deployment, your physical S24 browser, or real touch/mouse drag gestures (the saved reorder workflow was tested with the keyboard sensor). Firebase Console setup and authorized domains remain necessary. Tests do not consume production Firebase quotas.

Vite emits a non-failing bundle-size warning (about 254 KB gzip for the main JavaScript bundle); further code splitting is deferred. Firebase CLI warns that its next major version requires Java 21; this project uses the 14 series.
