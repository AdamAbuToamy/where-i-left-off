# WILO operations and recovery

Reviewed 2026-11-08. This is an actionable runbook, not evidence that every external service is configured.

## Release gate

Use Node 24, lockfile, and Java 21 for the emulator. Run lint, architecture, tsc/build, unit, Firestore rules, auth-recovery, Worker tests and relevant browser journeys. Browser runner rebuilds dist for emulators: **production build comes last**, with `VITE_USE_EMULATORS=false VITE_TEST_OFFLINE=false`. Scan credentials and staged source. Compare the public release manifest and asset hashes after Hosting publication. Keep the previous Hosting version for rollback. Never deploy Worker/rules/schema as an incidental UI change.

## If users cannot save or sign in

1. Read sanitized diagnostics and identify the failing boundary (auth, local persistence, remote write, provider). Do not request passwords/API keys or copy account content into logs.
2. Keep the pending/local draft. Distinguish an acknowledged remote write from queued local state; never report synced without acknowledgment.
3. Check Firebase service status, quota and recent rules/deploy changes. Do not weaken ownership/revision rules to make an error disappear.
4. If a UI release caused the incident, restore the previous Hosting version. If data/schema is involved, stop further destructive actions and prepare a reviewed repair; rollback of HTML is not rollback of data.
5. Reproduce in an emulator with disposable records and add a regression. Record cause, impact, mitigation and follow-up without account contents.

## Provider slowness

Check request IDs, status and bounded timing fields; distinguish HTTP 429, expired credentials and provider timeout. No keys/prompts in diagnostics. Do not retry a committed mutation or secretly switch the user's provider/model. Provider cost and live quota checks need a separate live account check; injected-provider tests do not prove live availability.

## Backups and restore drill

Account export and university JSON import validation exist. They are not a substitute for verified cloud disaster recovery.

Before claiming production recovery: an operator must inspect the current Firestore backup/PITR settings and D1 backup/Time Travel availability, record retention and recovery objectives, create/identify a valid recovery point, and restore **into a separate staging database/project**. Verify counts, ownership, revisions, university relations, session/checklist data and orphan handling with emulator/staging tests. Do not restore over production as a test. Confirm encrypted provider secrets can be recovered only with approved secret storage; never export them into ordinary JSON or Git. Record date and measured recovery duration. These cloud checks have not been performed by this UI task.

## Observability and cost

Before advertising an availability target, configure provider dashboards/budget alerts and a monitored health journey. Monitor error/429 rate, request latency (p50/p95), pending-write age, Firestore reads/writes, Worker CPU, queue retries and provider usage. Define thresholds against measured traffic; do not invent an SLA. Keep labels free of names, text, prompts, email and tokens. Verify the notification channel receives a test alert. A local log existing is not proof of on-call coverage.

## Scaling limits

Cloudflare and Firebase supply managed serving infrastructure. WILO still needs bounded work, indexing and account isolation. Existing university task pagination and bounded history do not mean the entire live workspace is server-paginated. A very large group/account inventory requires a separate cursor/subscription design that preserves offline edits, ordering and atomic revisions. Test a synthetic 10/50/200-client progression in an isolated staging project with spend limits before any concurrency claim. The local lookup benchmark measures only a join and never certifies production throughput.

## Security/tooling maintenance

`npm audit --omit=dev` is the runtime inventory; full `npm audit` includes development tools. Record each separately. Do not force major downgrades or suppress advisories to get green output. Patch a vulnerable chain only after checking the actual imports and testing CLI, emulators, lint/build and packaging. Use secret history checks before pushing. Broader DAST, legal compliance and license attestation are separate activities.

## Official workspace after consolidation

Use `/home/adam/projects/where-i-left-off` on main for Wilo development/build/deployment. `/home/adam/wilo-test` is retained as a recovery workspace with untracked evaluation/capture work; do not clean/reset or deploy stale builds from it. Recovery bundles/source manifest: `/home/adam/wilo-recovery/20261108-consolidation-160104`.

Assignment-reminder v1.1 rollout uses the existing Worker and Hosting. Apply only additive `push-worker/reminder-link-schema.sql` to existing D1 before the new Worker. Keep all remote bindings/variables/secrets (do not deploy stale local provider vars); use the existing protected credentials and data-only IAM. No new cron or external scheduler. Match Hosting and Worker release metadata to the reviewed main commit. Smoke checks are anonymous/read-only, with public OpenAPI/asset hashes and normal login entry availability; do not create real reminders as a health test. Actual OAuth/device delivery is a separate owner-driven verification.


### Universal reminders / immediate Push v1.3
Apply `push-worker/task-notification-schema.sql` and `push-worker/reminder-state-schema.sql` to the existing D1 before Worker rollout. Both are additive CREATE IF NOT EXISTS only. Preserve every remote binding/variable/secret and the existing minute cron/queue. No IAM change or Firestore rules/data migration is needed. Publish the matching OpenAPI and UI from the same reviewed commit. Metadata dispatch ledgers distinguish acceptance/failure/unknown; no handset acknowledgement is implemented. Unknown provider outcomes are not automatically resent. Use synthetic D1/Firestore fixtures and intercepted provider transport in tests; never send real card Push as a health check. Anonymous production checks verify contract/release identity and normal authentication denial, not authenticated success or handset delivery.


### Per-key quiet-hours override v1.4 / reminder UI repair
Inspect PRAGMA table_info before applying each ALTER in `push-worker/quiet-override-schema.sql`. Existing keys and pending jobs default to no override. This adds only three metadata columns; no card/task content migration or IAM/rules change. Deploy Worker after schema, then matching Hosting/OpenAPI. Owner-only Firebase/App Check key management updates the permission; Public API data credentials cannot update it. Permission is rechecked at delivery. An authorized new operation key can promote the same pending event; completed/processing events are not recreated. Preserve the existing event/device ledgers and all Worker bindings. The old reader can ignore the new columns, so the schema is backward-compatible. Do not test by sending live Push to real users.

Server project persistence omits the path ID. The university browser adapter removes that redundant ID when a user edits a legacy imported reminder card, using the existing ownership/revision rules; no blanket production repair is run. Group membership is checked for explicit personal reminders; automatic group reminders still require assignment. UI journeys cover desktop/mobile university editors and non-manager group members.


### Multiple card reminders v1.5
Apply `push-worker/multiple-reminders-schema.sql` once before deploying the new Worker (all statements are additive and safe to repeat). It creates two account-owned D1 tables plus an index; existing card settings, Firestore records, rules, account preferences and IAM remain unchanged. Then deploy the Worker and matching Hosting/OpenAPI. Preserve all19 existing Worker bindings and the existing minute cron/queue.

No eager user migration: existing settings are exposed as virtual id `legacy`. Independent rows use stable IDs, numeric revisions and hashed idempotency receipts. Queue messages carry reminder ID/revision; delivery rechecks current ownership, card/account switches and record revision before claiming the existing dispatch ledger. First dispatch freezes the event instant, preventing sent relative reminders from rearming after deadline changes. Unknown provider outcomes are retained, never blindly resent. Cancellation cannot recall an in-flight provider request. Cancelled records remain visible, with a bounded100-record collection per card.

Recovery: retain both additive tables and existing dispatch ledgers if reverting application code. Do not drop tables or restore the entire D1 database over new records. Old code can ignore the new tables but does not deliver independent rows; assess paused reminders before any rollback. No new secret, service, scheduler or paid dependency is required. Validate production anonymously via contract/version/invalid-key denial and release hashes; this does not prove authenticated writes or phone delivery. Never send real users a test Push as a release probe.
