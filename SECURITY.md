# Security scope and release gates

This beta uses Firebase Authentication and server-enforced Firestore rules. Hiding controls is not an authorization mechanism. Tests issue allowed and denied requests directly against the emulator.

## Covered boundaries

Private UID isolation; anonymous access; verified-email-only admin metrics access; self-escalation and self-unsuspension; field whitelists; revision/timestamp checks; unsafe link protocols; group membership and ownership; task assignment; canCreate revocation; invitations; group tombstones and cleanup; offline account separation and conflict handling.

## Known unresolved dependency findings — 2026-10-12

Full npm audit: 22 affected dependency entries (9 moderate, 12 high, 1 critical). These counts include transitive parents and are not 22 independent exploitable vulnerabilities. Production-dependency audit: 4 high entries in Firebase's Node gRPC dependency chain. The browser app does not expose a gRPC server; reachability has not been independently established. `tar` is the critical finding and is pulled through Firebase CLI tooling.

Do not run `npm audit fix --force` blindly: the resolver proposes major changes and even a Firebase downgrade. Remediation needs a separate branch with updated tooling/Java, lockfile review and all checks. The CI dependency-audit job intentionally fails on high/critical findings until resolved. Do not label a passing functional test run as a clean security audit.

## Limits

No penetration-test certification, production IAM review, quota/abuse/load test, real Google OAuth test or physical iOS/Android test was performed. Auth emulator tokens are synthetic. Tests do not prove the deployed Firebase console settings match local rules.

On shared devices, offline data is not encrypted with an application-specific key; protect the OS/browser profile. Account logout hides that account's cached content in the app but is not secure disk erasure. Removed members may retain previously downloaded data. Invitation links are bearer links and may be forwarded until revoked/expired.

Admin is currently a verified email allowlist. Suspending an account blocks application data through rules; it does not delete the Firebase Auth identity or erase offline copies.

Do not include real user data, access tokens, environment files, service-account credentials or production browser traces in issues/commits. For a suspected vulnerability, use private reporting if enabled on the repository; otherwise contact the maintainer privately before publishing details.
