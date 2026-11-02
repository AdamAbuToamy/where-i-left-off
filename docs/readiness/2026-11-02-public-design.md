# Approved design — public rollout, 2026-11-02

READY for this scoped rollout. Runtime commit 66fe233.

The approved design is now the default for every signed-in account, including ordinary accounts with no preview preference. The verified-admin check still gates only local design-management controls. Existing account-specific device fallback preferences are respected; admin toggling never changes another account or the public default. Sign-out removes the design attribute. The dashboard, administrator navigation, auth checks, Firestore rules and data permissions remain unchanged. Signed-out pages retain their normal entry UI and the shared loading screen.

Verified: npm test, 1237 passed across 113 files; TypeScript via production build; lint (zero errors, one pre-existing AssistantWidget warning); production build and credential pattern check; static route-bundle check. Seven Chromium/emulator journeys passed: two ordinary-account layouts (phone/desktop), two compact-card drag/reorder/expand/persistence journeys, and three university/persistence/UML/regular-account regressions. Ordinary accounts see the design without opting in, cannot see admin controls/navigation/dashboard, retain cards on reload, and clear the visual attribute on sign-out. Browser accessibility checks in the university journey also passed. The first university attempt expected full card actions before expansion; its flow now opens the compact card before asserting the existing actions.

No Firestore rules, worker, schema, auth-domain or model-provider changes. Rules/backend/auth-recovery suites were not rerun for this visual-default change; browser sign-in was exercised against disposable local accounts. No physical-device/live-provider check or production account write was performed. Production read-only verification is recorded in the adjacent proof JSON. This is not a claim of whole-product or app-store readiness.

Rollback: restore the prior Hosting release for a global rollback, or use Restore original for the verified administrator’s device/account only. No data migration or account reset is required.
