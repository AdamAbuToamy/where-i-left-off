# Public API readiness — 2026-11-08

## Delivery state

Owner authorized deployment and Git operations in the autonomous engineering request on 2026-11-08. **Worker and Hosting deployed.** No real user/account data writes or real user API key creation were performed. The release source is identified by Git history; remote delivery and the final commit hash are recorded in the session handoff.

Implementation committed and pushed to existing `origin/codex/admin-auto-header-fix`: `5733fc8a3c726216d74d938a5a16811177ebca0f`; remote ref read-back matched. A subsequent documentation-only commit records the final audit evidence without changing deployed runtime.

## Production verification — current session

- Existing Worker `wilo-free-push` version `c9208efb-9d79-4371-82b0-ad8fec30c261` deployed with remote variables, secret bindings, AI binding, D1, Queues and cron preserved. Metadata comparison after deployment passed. No provider inference or paid service was invoked.
- Additive `api-schema.sql` applied to existing D1 `wilo-push`; only CREATE TABLE/INDEX IF NOT EXISTS statements, no replacement, deletion or user-record mutation.
- Keyless `wilo-api-writer` configured with custom `wiloApiDataWriter`: datastore.databases.get and entities.get/list/create/update. User-managed writer keys: zero. Existing reader receives only iam.serviceAccounts.getAccessToken through custom `wiloApiTokenIssuer` on that writer resource. IAM Credentials API enablement and delegation read-back verified. Existing unrelated IAM grants preserved.
- Hosting released with mandatory Firebase/App Check production checks, existing assistant enabled, emulator/offline flags false. No Auth provider or Firestore-rule change.
- Website GET200; published OpenAPI GET200 and byte-identical to docs source; API courses without a key and tasks with a synthetic invalid key return401/no-store. Key-management POST without application Origin returns403; allowed Origin with invalid identity returns401. These prove routing/auth rejection, not successful authenticated data access.
- Isolated React browser checks passed at desktop1280 and phone390 with blocked outbound network. This is not live key issuance. Review also fixed a race where a key creation response could arrive after tab hiding; its secret is now discarded while hidden.
- **NOT YET VERIFIED:** real signed-in key issuance, authenticated API reads, live writer impersonation/Firestore transaction, Google login and actual reminder delivery. No user key was provisioned; no browser login was attempted. Operational service is deployed, but authenticated production functionality remains subject to owner verification.

## Implemented

- Account Settings API Keys UI in Arabic/English/Hebrew: name, explicit read/write scope selection, optional expiry, metadata-only list, last usage, state, revoke and atomic rotation.
- CSPRNG256-bit secrets displayed once with Copy and warning; secret display erased on close/tab hide/unmount; no local/session storage, analytics or tracing of responses. HTTPS/bearer-only public boundary; no-store/no-cache sensitive responses.
- Hash-only credentials, owner selected by server, per-request revocation/expiry/scope checks, account availability, request limits, safe bounded-retention audit, account-delete cascade and feature kill switch.
- Personal courses/tasks/exams/classes/cards/sections/board and existing per-card reminders. Read and write scopes are independent. Resource creates/updates use existing domain/planner and atomic Firestore receipts/revisions, not model inference or a parallel university system.
- Generic OpenAPI contract, usage examples, internal deployment/rollback instructions and ADR. No consuming application names or synchronization dependencies in the new runtime.

## Evidence

| Check | Result |
| --- | --- |
| `npm test` | Final post-race-fix run1325 tests /135 files passed. Initial1324 run was repeated only because security lifecycle code changed. Focused UI lifecycle4 passed. |
| `node --test push-worker/*.test.mjs` | 905 tests passed, including9 public API/key/runtime cases. |
| `npm run test:api:emulator` | 3 passed against actual local Firestore REST transactions: save/CAS/ownership, rollback, concurrent idempotency. |
| `npm run test:rules` | 691 tests / 17 files passed; private API receipts denied to normal owner/admin clients; ownership rules unchanged. |
| `npm run test:auth:recovery` | 4 passed against Auth Emulator. |
| Actual workerd + D1 | Passed key creation, hash-only listing, API use/replay, rotation, revoke with blocked outbound network and synthetic repository. This is not a live Firestore/IAM check. |
| Isolated React browser component | Desktop1280 and phone390 screenshots inspected; no horizontal overflow; one-time dialog opens/closes and secret node disappears. All account operations mocked; no login or upstream calls. |
| `npm run lint`, `npx tsc -b`, production `npm run build` | Passed. Existing Vite large-chunk warning remains; no new dependency added. |
| Architecture | Passed,34 checked modules; generated domain runtime freshness check passed. |
| Worker Wrangler dry-run | Packaged successfully; no deployment. |
| Credential/history checks | No findings; pattern-only limitations apply. History2635 blobs,18 binary,0 oversized skipped. |
| Post-commit credential/history checks | No findings;2675 reachable blobs,18 binary,0 oversized skipped. Production and Worker npm audits:0 findings. Full frontend/development audit:23 moderate,0 high/critical. No dependency change or forced remediation. |
| `git diff --check` | Passed. |

## Explicitly unperformed / limitations

- No live writer impersonation/data transaction, real user API key issuance or physical-device/store testing. Deployment and IAM metadata verification above do not establish these outcomes.
- Full signed-in browser journeys were not run: user prohibited automated Wilo login. Browser verification used a no-login isolated component harness; Auth recovery was tested with the emulator.
- `docs/knowledge/university/university_rules.md` does not exist in this checkout; it was not claimed as read. Repository engineering guidelines and current domain implementation were used.
- Generic edits of university-linked reminder records fail409 and direct users to the existing UI workflow. Per-card reminder settings work through the existing scheduler. Shared/group resources, hard deletes, account/security/admin/key-issuance operations, device/global notification opt-in, model execution and external synchronization are deliberately excluded (see usage guide).
- Rate limit60 requests/account/minute, management30/minute (revocation remains available), active keys10; snapshots cap2000 rows per collection and4 MiB per upstream response. Larger accounts fail413 rather than silently truncate.
- Revocation blocks subsequent requests; already in-flight requests may finish. Reminder setting PUT retains existing last-writer-wins behavior. Post-commit transient errors require retry with the same idempotency key.
- Backend writer is an internal keyless identity with data-only IAM. Firestore IAM is project-scoped: backend ownership/allowlist enforcement is essential, not delegated to Origin/App Check.
- Existing unrelated untracked assistant reports and older capture-import files were preserved.

## Rollback and next verification

Owner: create a narrowly scoped key in Settings → API Keys using the normal browser, provision it directly into the client secret store, then perform read-only verification. Do not infer success from the deployed settings bundle. Set PUBLIC_API_ENABLED=false to disable issuance/use without removing data; restore prior Worker/Hosting release if necessary. Retain additive tables, key revocation state and user data. Custom roles are documented against the [Firestore IAM permission mapping](https://firebase.google.com/docs/firestore/security/iam) and [service-account authentication permissions](https://docs.cloud.google.com/iam/docs/service-account-permissions); the issuer is narrower than the predefined Token Creator role.
