# Verification — 2026-10-12

Tests run against local demo Firebase emulators, never production accounts.

| Check | Result |
|---|---|
| ESLint | Passed |
| TypeScript + production build + service worker generation | Passed |
| Unit tests | 20 passed, no skipped tests |
| Firestore security/repository tests | 14 passed, no skipped tests |
| Existing browser scenarios | 9 passed in latest full run of those scenarios |
| New literal-markup and mobile-account-layout scenario | Added; final rerun pending after correcting a selector |
| Staged-source guard | Safe file accepted; environment file and synthetic service-account JSON blocked |
| Dependency audit | Not clean: 22 full-tree affected entries; 4 high production-dependency entries |

The new browser test originally used role=option for a language control implemented as buttons. Corrected to the existing .language-option button selector. Chromium redownload failed after the environment restarted, so the corrected test is not counted as passed.

Earlier browser runs exposed intermittent offline/group test failures: one delayed initial sync, one permission-denied response while syncing queued edits, and one card-submit timing failure. A targeted rerun passed both cases; three repetitions gave five passes and one initial sync timeout. The save helper now waits for form expansion to finish and allows 15 seconds for synchronization instead of five. The next full run passed all nine existing scenarios. The isolated permission-denied event was not conclusively explained; this remains a reliability observation, not a claimed production bug fix. No automatic retries or skipped assertions were added to turn failures green.

## What security tests exercise

- Own data access and denial to other users and anonymous clients.
- Invalid fields, unsafe URLs, oversized content, forged revision/time.
- Verified admin email versus unverified impersonation and another verified email.
- Admin restricted to metrics/suspension; private card content inaccessible.
- Self-unsuspension and metrics tampering denied.
- Group ownership/membership, private workspace isolation and task assignment.
- Member creation allowed/revoked/restored; no self-granting permissions.
- Invalid permission types and role promotion denied.
- Invite creation/revocation/expiry; group deletion and retry after interruption.
- Queued member creation denied after revocation; deleted group cannot be rejoined or resurrected.

## Browser flows

Phone-size card creation, sessions and persistence; links/week view; edits/order/delete; three languages; section/recall/checklist synchronization; capture links; offline reload/reconnect; concurrent conflict choices; account isolation; group lifecycle and member progress; shared-invite URL parsing.

## Why skipped appeared previously

The old npm test command included emulator-dependent suites with describe.skipIf when FIRESTORE_EMULATOR_HOST was absent. Skipped means not run, not successful. This update separates the suites:

```bash
npm test             # unit only
npm run test:rules   # starts Firestore emulator, runs security suites
npm run test:e2e     # Auth + Firestore + browser
npm run test:all     # lint, unit, rules, browser, then production build
```

Calling TEST_SUITE=security without the emulator now errors instead of producing a misleading green skipped suite.

## Limits and next gates

These are selected automated scenarios, not proof of 100% coverage or security. Real Android/iPhone installation, Google OAuth, production Firebase configuration, dependency remediation and the observed intermittent sync error require follow-up. The dependency-audit CI job remains red on known high/critical findings. No remote deployment or GitHub push was performed.
