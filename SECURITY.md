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

## Structured browser diagnostics (2026-10 update)

`src/lib/logging.ts` records allowlisted metadata: event, safe error code, UTC time, trace ID, UID, duration, fixed page category, environment and release and up to five sanitized same-origin source file/line locations. Raw exception messages, full stacks, project data, email addresses, invite tokens and passwords are never serialized. Unknown hash routes collapse to a fixed category. Repeated events are deduplicated for 30 seconds; each device/account keeps 200 records. Anonymous login failures stay on the device and are visible in the local viewer after login.

Authenticated diagnostics upload to `appLogs`, with a server-generated receipt time. Rules bind UID to the authenticated account, forbid extra fields, allow reads only to a verified administrator, and prevent payload editing. Repeat uploads may update only the receipt time. These are untrusted browser reports, not a tamper-proof server audit trail: a modified client can fabricate permitted metadata. Use Firebase service-side logs separately when investigating infrastructure issues.

No paid observability service was added. The viewer reads only on request, with a 200-record limit. Deploy `firestore.indexes.json` for per-user central queries. Local records are bounded; central retention is not automatically enforced. Configure Firestore retention or perform controlled administrative cleanup as usage grows; no paid TTL feature is assumed.

Only a verified administrator can open the diagnostics viewer; Firestore rules enforce the same restriction for central reads. The `adam2002hosny@gmail.com` account has no suspend/restore control in the dashboard, and Firestore refuses any administrator attempt to suspend that account. Personal display names update only the signed-in user's own membership documents. That permission cannot change role, email, joining time, invitation or creation privileges. Existing email-derived names are displayed as `Member` until the user supplies a name. Roles remain enforced by Firestore, independent of hidden UI controls.

## Deferred deletion

`accountDeletions/{uid}` accepts only fresh authenticated self-requests with server timestamps while the privileged worker heartbeat is current; the protected administrator address cannot request deletion. A request blocks data access, including after identity deletion when a minimal completion tombstone prevents stale ID tokens from recreating data. Only the owner can read or cancel pending requests, with server rules enforcing a strict 24-hour window and recent authentication. Clients cannot list or update requests or write worker availability. The worker performs privileged Auth and Firestore cleanup, transfers shared group ownership, removes memberships and assignments, and uses transactional processing leases to avoid cancellation races. Service-account credentials belong only in the server environment/GitHub Secrets. The workflow is opt-in and is not activated here. Remote offline caches cannot be wiped. Full security/worker behavior requires emulator and staging verification before enabling requests.

## Announcements and password notifications

Group announcements are manager-created, immutable and member-readable. Members cannot reply, modify or delete notices; managers may delete them. Removing membership denies server reads. The idle view is not an authentication lock or privacy shield: it preserves signed-in sessions and synchronization, and now intentionally displays actual personal and assigned task cards at the user’s request. It blocks editing from the presentation; account-deletion and suspension gates still apply.

Password changes reauthenticate with the current password. A verified, recently authenticated active user may queue only their own fixed password-change notice. Client requests cannot supply recipient addresses, content, or send states. The SMTP worker resolves recipients from Admin Auth, uses TLS and leases processing requests. Notifications are best effort and hourly; a mail failure must not misreport an already successful password change. SMTP settings and service account credentials are GitHub Secrets, never frontend variables. Rules rate-limit replacement requests; worker credentials remain privileged. No live SMTP messages were sent during validation.
