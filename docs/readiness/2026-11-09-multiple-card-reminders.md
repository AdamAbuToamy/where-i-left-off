# Multiple independent reminders — readiness, 2026-11-09

## Design and boundaries

Decision: add account/card-owned reminder records to existing D1, keeping card settings as the backward-compatible virtual `legacy` record. Replacing the old schedule with an array would break existing clients; copying it eagerly would risk duplicate delivery. No Firestore migration or new scheduler. Both authenticated UI and scoped Public API call the same collection adapter; normalization/timezone rules stay in the shared schedule domain. New records reuse existing queue, provider transport, idempotent delivery claims and notification history.

An explicit create never overwrites a sibling. Edits/cancellation use record revision; legacy edits use settingsVersion. Operation receipts are hashed and atomically committed with mutation; card opt-in is CAS guarded in the same D1 transaction. Event identity contains record ID/revision/instant. Before the first provider attempt relative dates follow deadline edits; after dispatch starts the instant is frozen. Absolute times retain their chosen instant. Queue retries cannot rearm completed/unknown delivery. Cancellation remains visible; explicit edit alone rearms the selected record. Limit100 independent records/card including cancellation history; no pagination. Account/card switches and account-zone quiet hours apply to every record.

Automatic defaults are suppressed once a card has independent records, including cancelled rows, so cancellation cannot resurrect a fallback alert. Existing explicit legacy/weekly schedules stay separate. Old global-card DELETE stays compatible; new item DELETE cancels only that selected record. Group users configure personal reminders via UI under existing membership checks; Public API still exposes owned personal cards only.

## Verified locally

- Application:1336 tests passed,138 files.
- Worker:952 tests passed, recorded in operator log `/tmp/wilo-multi-worker-final.log`; includes12 dedicated multiple-reminder integration tests.
- Firestore rules:693 tests passed; existing rules unchanged.
- Authentication recovery:4 tests passed.
- Browser:7 journeys passed, desktop/mobile reminder CRUD, settings without local Push permission, university/group member editors and public documentation navigation/copy/download/RTL. Browser uses isolated synthetic emulator records and intercepted Push HTTP, not production delivery.
- API examples:93 generated requests,6 workflows,9 error cases;67 JSON bodies validated against OpenAPI. Synthetic local HTTP only.
- Integration tests use real in-memory SQLite/D1 adapter, API keys and repository boundary: three coexisting records, isolated edit/cancel, idempotency, account/scope denial, relative4/2 calendar days, quiet hours, opt-out, device withdrawal, queued edits/cancellation, lost queue recovery, provider uncertainty, old settings preservation, no resend after deadline edits, UI/API shared records.
- Lint, TypeScript, architecture checks passed. Production build and credential scans passed; public Firebase/App Check settings preserved. Existing large-chunk build advisories remain.
- New Chrome toolbar/management icons generated from the existing supplied original symbol, sizes16/32/48/128; no permission or runtime behavior changes. Manifest0.4.1.

## Production verification boundaries

Deploy only after passing gates, additive schema first, preserve live Worker configuration. Post-deploy public contract and release/version hashes plus unauthenticated endpoint denials are recorded in `.wrangler/multiple-reminders-production.json`. These are read-only checks. No real user cards/reminders modified and no unrequested Push sent. Authenticated production CRUD, physical Android/iOS arrival, real Google OAuth and Chrome Web Store approval are NOT VERIFIED by emulator/read-only checks. Store upload requires publisher access; a ready0.4.1 zip is retained in the recovery directory.

## Recovery

Official workspace `/home/adam/projects/where-i-left-off`; old `/home/adam/wilo-test` unchanged. Baseline Git bundle and pre-verification source patch: `/home/adam/wilo-recovery/20261109-multiple-reminders`. No secrets, sessions, device subscriptions or production content included. Keep new D1 records/ledger on rollback; never drop tables as a recovery shortcut.
