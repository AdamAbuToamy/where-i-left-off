# Validation — pages, personal names and diagnostics

Source baseline: the supplied `where-i-left-off-current.zip`, materialized on 2026-10-13. The private GitHub repository was not accessible; this update does not claim to incorporate newer unseen commits.

Completed checks:

- `npm ci --ignore-scripts`: succeeded with the existing lockfile.
- `npm run build`: succeeded; TypeScript and Vite production bundling completed, followed by offline-shell generation. The build used no production Firebase configuration and is a source validation build, not a deployable live account build. Vite retains the existing large-bundle warning (about 939 kB uncompressed).
- `npm test`: **39 tests passed in 9 files**. Includes diagnostics metadata privacy, source-location sanitization, 200-entry bounds, deduplication, account isolation, page/deep-link parsing, name validation, protected-admin visibility and suspension guard, admin-only log routing, and server-rendered card permission visibility, plus existing offline/project/translation tests.
- `npm run lint`: succeeded.
- Shell syntax checks for the installer and production deployment script: succeeded.
- Installer smoke check in a temporary project: confirmed backup contents, preservation of `.env.local` and `.git`, and copying the updated source and indexes. npm was stubbed only for this installer smoke check; actual source installation/build/unit checks are listed above.
- Browser test source parsed successfully and Playwright discovered **12 tests**. Existing scenarios were adapted for named registration, separate groups pages, dropdown filters and card action menus. A new scenario covers pages, profile naming and diagnostic privacy.

Not completed:

- **Firestore security tests have not passed here.** The default Java 17 is incompatible with Firebase CLI 15.33.0. A locally extracted Java 21 was attempted; the emulator exited before any tests ran with `ClassFormatError: Incompatible magic value 0 in class file sun/misc/Unsafe`. Disabling class-data sharing did not resolve it. The new log-access and membership-name security tests are included and must run using a working Java 21 runtime before deployment.
- Browser scenarios were **not executed**; no phone screenshots or browser visual verification are claimed.
- Live Google sign-in, deployed indexes, central log uploads and administrator-only queries, and cross-device behavior against production Firebase remain unverified.
- **No Firebase deployment, GitHub push, or Sites publication occurred.** No signed-in Firebase account or private repository credential was available. No hosting audience/access setting was changed.

Run locally with your existing configuration and Java 21:

```bash
npm test
npm run lint
npm run build
npm run test:rules
npm run test:e2e
bash scripts/deploy-production.sh
```

Before running the deployment command, confirm the security/browser checks pass. The deployment helper keeps the existing Firebase project and hosting target, and now deploys the diagnostics index together with rules and hosting. The updated source does not add a paid service.

## Interactive onboarding, themes and account deletion

The tour now directs real card creation; success is driven by the successful add operation. Four per-account local themes and password-reset controls were added. Deferred account deletion includes recent identity confirmation, server timestamp rules, 24-hour cancellation, data-access blocking and a leased, idempotent admin worker with GitHub Actions. The worker is not activated remotely. Rules tests were attempted again with extracted Java 21, CDS disabled and Netty Unsafe disabled; the emulator still exited before tests with ClassFormatError in jdk/net/ExtendedSocketOptions. Chromium installation failed because the downloaded archive was truncated. Build, unit tests (32) and lint succeeded. No real account was deleted or Firebase rules deployed. See UPDATE_SETTINGS_AR.md for activation and limitations.

## User-side emulator report, 2026-10-13

The attached terminal report confirms the user’s Java/Firestore emulator runs. 17 of 19 security tests passed, including all account-deletion tests. Two test expectations were incorrect: a member wrote the unchanged canCreate=true value (a no-op), and the diagnostics integrity assertion read as the record owner after reads became administrator-only. The group test now first revokes permission as the manager, then asserts that a member cannot grant it back; the log assertion reads as the administrator and separately denies owner reads. No production rules were weakened. The corrected security tests still require a user-side rerun before publication.

## Second user-side report

All 19 security tests passed after the two expectation fixes. Browser tests ran: 7 passed and 5 failed; the interactive tour/theme scenario passed. Older browser helper copies did not dismiss the introductory tour, so optional card fields were hidden and group reload reopened the tour. The current helper explicitly waits for navigation and dismisses the tour outside the dedicated tour scenario. The product now only auto-starts the tour on the personal page so deep-linked groups/settings are preserved. The profile success assertion targets its own form to avoid matching the account-deletion availability status. These corrections require another browser rerun; publication is still pending.

## Reproduced root causes, third user report

The second patch missed the old login helper because an End tour substring already existed. The three hidden-field failures were also directly caused by a tour CSS display:none rule. That rule was removed; the helper is fully replaced with deterministic registration, page-readiness and tour-dismissal assertions. The group offline-reload failure exposed the account lifecycle gate waiting indefinitely for a server snapshot: a React/jsdom regression reproduced two failures (cached active projects blocked and cached pending deletion lost), and both passed after persisting server-verified per-account state and preserving it on cache-only missing snapshots. An additional test verifies account isolation and another verifies optional-field visibility. The group test now waits for successful local commit/editor closure before reload. Browser action waits are capped at 8 seconds; the run stops at first failure, and test:e2e:failed repeats only the failed scenarios. All 36 unit tests pass; build and lint checked. The corrected browser scenarios still need the user’s working emulator/browser to execute before publication.

## Registration-tour test correction

The latest user run confirms all 36 local tests and the production build passed. The focused browser run stopped on an incorrect helper precondition requiring automatic tour visibility for every new registration. That assertion has been removed: navigation readiness is awaited, any visible tour is dismissed, and absence is accepted. The dedicated interactive tour scenario still explicitly opens the tour and verifies real card creation and theme persistence. No application guard or security rule was disabled. Playwright’s last-run reporter includes tests that did not run after maxFailures, so the next failed-only run still targets all four pending scenarios. Only the browser helper changed; lint passed, browser execution remains pending.

## Exact accessible-name failure reproduced

The latest browser report showed the guide exists while the exact End tour button lookup fails. The actual name was End tour ×: the decorative close symbol participated in the accessible name. Previous absence/timing explanations did not identify this root cause. A React/jsdom regression with dom-accessibility-api reproduced the same mismatch in Arabic, English and Hebrew (three failures before the fix). The button now has an explicit translated aria-label and an aria-hidden decorative symbol. The generic browser helper uses the guide-scoped close button; the dedicated interactive scenario still checks translated role/name selectors. All three accessibility regressions and all 39 local tests pass after the fix, plus build/lint. Actual browser scenarios and deployment still require the user environment.

## Continue now, numbered checklists, reports, announcements, password changes and sleep

Local validation on 2026-10-13: 51 unit tests passed in 13 files, followed by 3 task-overview access regressions in one new file (54 tests across 14 files total). The access tests check own personal cards, assigned-only group cards, membership revocation, suspension, and permission-denied cache exclusion. React/jsdom tests exercise sleep timeout/activity, draft retention, wake-click consumption, disabled/anonymous behavior; password reauthentication/update ordering, mismatch guards and successful changes despite mail failure. TypeScript production build and lint passed. Script syntax checks passed. Playwright parsed/discovered 14 browser scenarios, including checklist persistence/PDF download and manager broadcasts between two sessions; discovery is not execution.

The shared PDF exporter generated a real Arabic two-page report using a Canvas adapter. Both pages were rendered with pdftoppm and visually inspected: connected Arabic, page numbers, long links and checklist completion markers are present without clipping. The generated PDF uses page images rather than searchable text. The PDF module is loaded on export rather than included in the initial application bundle. No real user data was used.

New Firestore cases cover immutable manager-only announcements, outsider read denial, member reply/delete denial, spoofing prevention, deleted-group announcement cleanup; password notice rules test verified recent self identity, arbitrary-recipient rejection, send-state and lease protection, and missing worker heartbeat. These new rules cases have not executed in this environment. The user's previously reported 19 passing security tests predate these changes. The known Java/emulator and Chromium download failures were not retried blindly. Browser scenarios and the new rules must execute in the working user environment before publication.

SMTP confirmation is implemented as a leased server outbox worker with a separate readiness heartbeat, fixed localized templates and Auth-resolved recipients. It requires SMTP_CONFIG plus SECURITY_EMAILS_ENABLED in GitHub and a verified user email. Delivery is hourly, best effort. No SMTP credentials were available here; no actual message was sent. In-site password changes do not depend on mail delivery. Forgotten-password handling remains Firebase reset email. No Firebase deploy or GitHub push occurred.

## Requested idle-card and layout refinements

The user-requested idle presentation now shows actual personal and assigned cards, not generic placeholders. It retains account-lifecycle and suspension gates, cycles cards every 8 seconds, omits editing controls, and respects reduced motion. This intentionally exposes task content on the screen during idle presentation; it is not a privacy shield. The PDF button occupies its own report section and the tour has a distinct settings section. Four vivid palettes were added without replacing saved theme keys. Password-change feedback distinguishes unverified email, and worker readiness expires while the settings page remains open.

All 57 unit tests in 15 files passed, including actual card rendering/cycling/reduced-motion and unverified-email feedback. Production TypeScript/build and lint passed. The user's spacing screenshot was inspected. No new actual browser visual verification, Firebase emulator execution, SMTP activation, message sending, deployment or GitHub push is claimed. The earlier environment blockers were not retried.
