# Admin header promotion timing — 2026-11-02

Name displays for 15 seconds; each promotion displays for 5 seconds, then returns to name. Existing admin opt-in, motion, install click behavior, and loading correction preserved.

Verified: 10 focused unit tests, TypeScript, isolated Chromium/Auth/Firestore-emulator journey (45.4s), lint (zero errors, one existing warning). Production build and credential pattern check are recorded in .wrangler/header-ad-build.log. No live provider tests or physical installation performed. Production account writes: zero. Publication verification is recorded separately in the matching proof JSON. This is a scoped UI readiness check.
