# Wilo consolidation and assignment reminder API — 2026-11-08

## Authority and recovery

Owner explicitly authorized implementation, backups, logical commits, fast-forward main, normal push and deployment, with no other-repository modifications or real assignment/reminder production writes.

Reverified official main fe41c671494f7064122023108a95bca6a80a472b is an ancestor of development4eaa13ca4c27506f5c728a0d30fbfadcd7823eaf (0/156 unique commits). GitHub main07178f2edb72833ff251c4d5969c47307d47c1d4 is also its ancestor (0/92). Official tree initially clean. Development had10 modified and77 untracked files, including65 evaluation artifacts.

Recovery: `/home/adam/wilo-recovery/20261108-consolidation-160104`. Two verified Git bundles, binary working patch,22 modified/untracked source/doc files with SHA256 manifests. Environment files, credentials, browser profiles and ignored runtime/production stores were excluded. Evaluation contents remain untouched in `/home/adam/wilo-test`, with a separate65-entry hash/size manifest; they are not staged or copied into official source. Git/source credential pattern checks found no matches; this is not a guarantee of arbitrary-format secret detection.

The four old capture-import adapter/doc/test files are preserved in recovery/development for independent review; they are not runtime Public API features and are not introduced into the standalone Wilo platform. No other repository is changed by this task.

## Implementation

- Retained deployed documentation, hidden API key creation form, settings-only documentation link and deletion-on-revocation/rotation behavior.
- Native university card field projection shared between UI and API; browser behavior unchanged. Existing domain validators/ProjectEntity, account timezone/preferences, cards/scopes/events/queue scheduler reused.
- POST /api/v1/tasks/{id}/reminder scopes: courses:read tasks:read tasks:write reminders:read reminders:write. expectedRevision + Idempotency-Key. GET same path scopes: tasks:read reminders:read.
- Deterministic owner/task card identity, transactional task/card/receipt/outbox, paused initial card, insert-if-absent D1 settings, revision/mutation guards, existing/manual links read without rewrite. Transient errors return202/pending; actual read-back distinguishes scheduled, disabled, awaiting-device, outside-window, manual-recurring, incomplete, blocked and unlinked. No push delivery claim.
- Additive reminder-link-schema.sql recovery hints drained by existing Worker cron; no new scheduler, service, database or IAM permission. Hint persisted before Firestore prevents stranded partial commits; publish/wake acknowledgement is checked before reporting scheduling. Recovery cannot overwrite concurrent manual edits.
- Missing `docs/knowledge/university/university_rules.md` remains explicitly unreviewed because absent.

## Verification / delivery

Results and final release evidence are appended after execution; no unperformed check is passed by this document.
