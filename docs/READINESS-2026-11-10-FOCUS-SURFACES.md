# Focus surfaces readiness — 2026-11-10

## Scope
- Docked card layouts wrap toolbar filters within their actual available width.
- Card expansion affordance uses visible keyboard focus, rather than retained mouse/programmatic focus.
- Compact card reminders open in a reusable native modal with a bounded frame, dismiss control and blurred backdrop. Escape closes only the foreground window.
- Existing native dialogs share backdrop treatment; choice pickers gain a framed panel and visual dim/blur layer, retaining existing outside-click and keyboard behavior.
- Mobile focus windows are excluded from the old forced-fullscreen dialog rule.
- No persistence, scheduling, API, authentication, ownership or Push behavior changed.

## Evidence
- Application: 146 files, 1366 tests passed (final application run).
- Browser: six Chromium journeys passed: docked card details/edit preservation, grouped views/pickers, university and group reminders; desktop and phone viewports.
- Additional bounded-modal phone/desktop rerun: 2/2 passed; reviewed both screenshots.
- TypeScript, architecture boundary check and credential pattern check passed.
- ESLint and production build passed. Public release asset comparison is the final deployment gate.
- Synthetic emulator records only; no real user writes or live Push messages.

## Limits
- Phone checks use a Chromium viewport, not a physical handset.
- Blur/frame behavior applies to native dialogs and shared choice pickers; ordinary inline disclosures remain inline.
- Production proof is stored outside Git under /home/adam/wilo-recovery/20261110-focus-surfaces/production-proof.json after deployment.
