# Per-user public API over existing Wilo capabilities — 2026-11-08

## Context

Trusted external applications need scoped personal data access without browser sessions. Existing UI/Chrome logic owns record validation and atomic revisioned persistence. External keys must never acquire account/security/admin access or become Firebase credentials.

## Decision

Use the existing Cloudflare Worker and D1 database. Browser Firebase Auth + App Check + Origin protect account key management; separate random256-bit bearer secrets authenticate the public resource API. D1 stores only SHA-256 digests and safe metadata. Key owner is server-selected on every request. No client/account configuration or client-specific synchronization is introduced.

The public application service calls the existing pure `planAssistantChanges`, university backup validator and board parser. The planner receives an optional ID factory so API-created cards retain current20-character reminder-compatible IDs while all existing callers retain UUID behavior. A generated ESM runtime gives Node/Worker the exact same TypeScript policies; CI checks artifact freshness. The only shared import extraction is the existing university duplicate/source-link predicate, preserving Chrome behavior.

Existing personal Firestore collections remain unchanged. `apiOperations` is private backend receipt metadata; each resource write and its receipt commit in one transaction. REST transactions additionally read account suspension/deletion state. Keyless impersonation separates the protected existing reader signer from a short-lived data-only writer identity. IAM remains internal Wilo configuration. No new credential leaves the backend.

Reminders use the same existing D1 card settings store, wake function and delivery scheduler. No parallel reminders or device opt-in is added. Generic edits of university-linked reminder records fail closed until a later application use case can coordinate them; groups/security/deletes/model calls are excluded explicitly.

## Alternatives

A Firebase custom-token exchange would expose broader Firestore access outside scopes. A general service-account key for consumers would break tenant isolation. Duplicating domain validation in JavaScript would drift from the UI. A new hosted API service would add deployment/cost without benefit. All were rejected.

## Consequences / limits

The internal writer's IAM authorization is project-wide; owner/path allowlists, authenticated account checks and domain invariants are therefore mandatory and tested. API collection snapshots are deliberately bounded and fail413 when too large; no silent partial state. D1 and Firestore cannot share a transaction: key auth/audit and resource writes remain separate, so idempotent retries recover uncertain post-commit responses. Revocation affects subsequent requests; in-flight requests may finish. Reminder setting updates retain current last-writer-wins behavior. Public support is broad but intentionally personal, not a raw database interface.

## Operational authority

Owner explicitly authorized production IAM, additive D1 migration, Worker/Hosting deployment and Git Commit/Push on 2026-11-08. IAM, migration and deployment completed; health/auth rejection and unchanged remote bindings verified. Real user key issuance/authenticated access remain unverified. No real user-data writes were used for testing. See the dated readiness report for evidence and Git delivery status.
