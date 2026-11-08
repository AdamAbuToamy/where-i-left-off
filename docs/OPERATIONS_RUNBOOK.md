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
