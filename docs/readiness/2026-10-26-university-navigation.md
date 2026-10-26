# University navigation follow-up — 2026-10-26

Scope: compact searchable course navigation (six per page), stable order through cloud snapshots, current-course badge and separate detail panel, linked course/task notes, next-deadline course name, dismissible success messages that expire after ten seconds. No schema, security-rule, model-provider or reminder-policy changes.

## Evidence

- Application suite: 1,125 passed before the final stable-order regression; final focused University suite: 12 passed, including the new reordered-snapshot case.
- Chromium with disposable Firebase Auth/Firestore emulator accounts: 2 University journeys passed on final source. The new journey imports 14 synthetic courses, waits for cloud sync, checks selection and pages/search, note URLs, next-course context, notice dismissal and no horizontal overflow at 1280px and 390px. Existing edit/checklist/timetable/reload journey still passes.
- Desktop and phone screenshots reviewed locally; generated screenshots remain untracked.
- TypeScript build, production bundle, lint (zero errors; existing AssistantWidget ref-cleanup warning), architecture boundaries and credential-pattern scan passed.
- Message expiry and reminder-success behavior use an injected reminder adapter in application tests; browser tests check dismissal with a real import-success notice. No production reminder or account-content writes were performed.

## Limits

Chromium mobile emulation is not a physical-device or Safari/Firefox check. This focused change does not rerun live-model acceptance, provider authorization, store installation or physical push delivery. The earlier general readiness report remains historical evidence for its original source. Deployment is verified separately through GitHub checks and the public release fingerprint.
