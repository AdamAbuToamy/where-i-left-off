# Security scope

Where I Left Off uses Firebase Authentication and server-enforced Firestore rules. UI visibility is not authorization. The security suite sends allowed and denied requests directly to the Firestore emulator.

## Current verification — 2026-10-13

Commit `f0a16bc` passed both CI jobs, including the blocking high/critical dependency audit. The local full-tree npm audit reported **0 known vulnerabilities**. There are no audit exclusions or allowlisted advisories in this workflow.

The earlier dependency findings were remediated by updating Firebase tooling and scoped dependency overrides. [Tooling maintenance](docs/TOOLING_SECURITY.md) describes the supported interfaces, compatibility checks and constraints. Do not remove or blindly extend overrides when adding new Firebase features. [TEST_RESULTS.md](TEST_RESULTS.md) records the actual evidence.

## Covered boundaries

Private UID isolation; anonymous access; verified-email-only admin metrics access; self-escalation and self-unsuspension; field whitelists; revision/timestamp validation; unsafe link protocols; group membership and ownership; assignment and creation permissions; invitations; group deletion; offline account separation and concurrent edit conflict choices.

## Limits

No penetration-test certification, production IAM review, load/abuse test, real Google OAuth test or documented physical-device installation/share-sheet test was performed. Emulator tests do not prove the production Firebase console settings match the local configuration.

On shared devices, cached data is not encrypted with an application-specific key. Protect the OS/browser profile. Logout hides that account's cached content in the app, but is not secure disk erasure. Removed members may retain previously downloaded data. Invitations are bearer links and may be forwarded while valid.

Admin access uses a verified email allowlist. Suspension blocks application data through rules; it does not delete the Firebase Auth identity or erase offline copies.

A clean dependency audit is a check against known advisories at a specific time. Keep CI enabled and recheck dependency updates.

## Reporting a vulnerability

Use GitHub private vulnerability reporting if enabled on this repository. Otherwise, contact the maintainer privately before publishing exploit details. Never put real user records, access tokens, service-account credentials, environment files or production browser traces in public issues.
