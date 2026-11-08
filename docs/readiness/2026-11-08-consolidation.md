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

## Completed local verification and integration

- Development application suite1330 passed; official-directory suite1325 passed. The5-test difference is the preserved, untracked legacy capture adapter excluded from official runtime/source, not a removed deployed feature. Public documentation/key settings9 tests passed; browser5 journeys passed; synthetic key component phone/desktop checks passed.
- Worker915 passed in both development and official directories; focused linking9 passed after the final ownership-before-recovery-hint guard. Firestore REST emulator4 passed; Firebase rules691 and Auth recovery4 passed. No security-critical failures remain.
- OpenAPI:63 generated request examples +3 workflows +9 HTTP failure cases executed on a synthetic local server;42 JSON bodies validated. No authenticated production task/reminder writes.
- Lint, tsc, architecture38 modules, generated domain freshness, production build, source/history credential checks passed. Existing Vite large-chunk warnings remain.
- Official main fast-forwarded to the full development history; original development copy/evaluation files retained. Additional official-directory compatible release fix reads App Check configuration from Vite modulepreload chunks, not only the entry script. Two focused tests passed. It preserves public Firebase/App Check identifiers without a new key or IAM change. Runtime lockfiles installed using npm ci.
- Existing keyless writer role/delegation read-back verified: data get/list/create/update only, no IAM broadening or user-managed private key.
- Production delivery evidence is recorded in the release manifest (commit/version and asset hashes) and protected operator verification output; this report is the pre-release local gate, not a claim of actual reminder delivery.
