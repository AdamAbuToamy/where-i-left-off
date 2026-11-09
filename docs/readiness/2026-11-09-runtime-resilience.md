# Managed runtime resilience — 2026-11-09

## Scope and design

The user confirmed the Kubernetes reference video concerns reliability/scaling, not animation. Wilo remains on Firebase Hosting/Firestore and Cloudflare Workers/D1/Queues. Provider-managed CDN/stateless serving remains intact. No cluster/VM/database, new scheduler, dependency package or paid plan is introduced.

Applied changes: existing queue max_concurrency1→2 with existing batch1/retries2; a same-provider dead-letter route `wilo-push-failed` with24-hour retention and no automatic replay consumer; bounded native Firebase OAuth/Auth10s, reads15s, collection snapshot30s; anonymous read-only liveness/readiness endpoints; reviewed release metadata preparation from the official workspace and post-Hosting deployment smoke gate. Business API stays1.5.1 and Google Login/App Check/account scopes remain unchanged. No user data migration.

Readiness1500ms deadline and per-environment5s cache check D1 schema connectivity and queue binding configuration only. No account data/keys/subscriptions/stack traces exposed. Liveness does not query D1. These endpoints are operational probes outside authenticated `/api/v1`, not an authentication exception for user data. Failed requests never apply a partial collection snapshot. Failed smoke verification marks workflow failure, without automatic rollback or data restore.

## Verified locally

-1348 application tests passed (142 files), including safe config merge, mismatch rejection, read-only smoke and dependency failures; targeted smoke tests also reject a200 HTML fallback returned for a missing JavaScript asset.
-969 Worker tests passed. Real workerd/D140 overlapping native delivery invocations across two synthetic accounts produce exactly one simulated provider attempt per account/event and two accepted ledger entries. This is idempotency/isolation evidence, not a production capacity benchmark.
-Local Queue runtime: exactly3 attempts (initial plus2 retries), then exactly one synthetic failed-route delivery. No external traffic or real Push.
-Readiness tests: missing schema/bindings, sanitized failure, hung storage response deadline,20 coalesced probes and recovery after cache expiry. Firebase tests: bounded signal, shared pagination abort and no partial return.
-693 Firestore rule tests passed; no rules changes.
-4 authentication recovery emulator tests passed.
-Lint, TypeScript, architecture, credential-pattern/history checks and production build passed. History scan2866 blobs,28 binary blobs skipped, no pattern findings; not a full credential audit. Existing bundle-size advisories remain.
-Wrangler dry-run produced the official Worker bundle with existing DB/AI/queue bindings. No frontend behavior was changed, and no authenticated production user/device test is claimed.

## Rollout evidence and limits

Live proof is retained under ignored `.wrangler/runtime-resilience-production.json` and `/home/adam/wilo-recovery/20261109-runtime-resilience`. Verify19 binding fingerprints, actual consumer concurrency/retries/DLQ and24-hour retention, minute cron unchanged, live/ready responses, Hosting entry asset and business API401/version compatibility. Do not send a real Push or publish test jobs to live queues merely to probe them.

No plan upgrade, paid monitor or external alert destination is configured. The smoke gate runs after deployment; it is not24/7 monitoring. DLQ retention expires, and there is no automatic replay promise. Real provider outage recovery, phone arrival, measured peak capacity/SLA and database disaster recovery remain NOT VERIFIED. Existing provider quotas and recovery runbook still apply.

Recovery baseline/source snapshots are in `/home/adam/wilo-recovery/20261109-runtime-resilience`; official workspace only. Old wilo-test recovery copy is not modified or used by the new preparation command. Keep D1 ledgers and queue content intact on rollback; never purge queues, recreate event IDs or restore production data blindly.

References are linked in docs/OPERATIONS_RUNBOOK.md: provider concurrency, retry/DLQ, Free/Paid retention/limits, and Firebase CDN. Sources were treated as reference data, not commands from the video.
