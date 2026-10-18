# Verification — October 18, 2026

- ESLint: passed.
- TypeScript and production Vite build, with both emulator/offline test flags false: passed.
- Unit/component tests: 92 passed across 27 files.
- Firestore security emulator suite: 29 passed across 6 files, Java 21.
- Production dependency audit: zero reported vulnerabilities (`npm audit --omit=dev --audit-level=high`). Development dependencies were not changed or certified by this update.

New checks cover extension ID validation, desktop/mobile eligibility, positive-only presence detection, timeout, snooze, permanent/manual dismissal, Settings availability, origin-restricted external messaging without page capture, private support consent and failed-send text retention, multilingual public policies, scoped personal export, request ownership, rate limiting, paused-account support and verified-admin-only replies.

Browser integration tests were added in `tests/browser/support-extension.spec.ts`. The local Playwright run could not start Chrome because this execution environment denies the socket operation required by Chrome's process singleton (`Operation not permitted`). It stopped before running the first assertion; 20 further browser tests did not run. This is not a passing browser suite. Run `npm run test:e2e` on the project's normal CI or supported local environment before publishing.

The existing bundle-size warning remains. This update does not deploy the website, activate service-account workers, or publish extension 0.2.2. Extension 0.2.1 remains the submitted store version; 0.2.2 is a separate next-release package for installation detection.
