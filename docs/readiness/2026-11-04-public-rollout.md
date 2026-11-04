# Final experience public rollout — 2026-11-04

Decision: READY for public rollout of the approved version. Existing physical-device/live-model limitations remain as previously recorded.

- Published visual/phone feature gate now covers signed-in accounts. Normal accounts receive the latest card form, University navigation, mobile bottom bar, planning-board entry, controls and notification bell. Admin routes/role checks and Firestore rules are unchanged. Phone language/sign-out actions are available to ordinary users too.
- Verified users may read their own notification history; authenticated UID and account availability still determine every database query. Unverified identities and missing UIDs remain rejected. No schema migration, provider setting or key change.
- Worker version 83abe814-b1d2-44e3-b749-90ac83bdb978 published with --keep-vars using an existing binding config with vars omitted. Compared remote before/after versions: all bindings (including provider variables and secret binding names) match. No secret values fetched or printed. Proof: 2026-11-04-public-worker-proof.json.
- Production read-only smoke: unauthenticated notification POST returns 401; allowed-origin OPTIONS returns 204. No production writes. Proof: 2026-11-04-public-worker-http.json.
- Backend: 890/890 passed (.wrangler/public-rollout-backend.log), including ordinary verified notification owners, account isolation, and HTTP-supplied victim UID rejection.
- Browser: 8/8 Chromium emulator journeys passed (.wrangler/public-rollout-browser.log), including ordinary account bell/final design without an Admin link, phone Arabic form/navigation, saves, RTL hover and notification drawer. No actual handset/store check.
- Unit: 1277 passed initially; four CloudApp shell tests exposed an unmocked newly enabled NotificationBell with a fake Firestore handle. Added that outer-service mock to the shell-only harness, then all 7 CloudApp/design gate tests passed (.wrangler/public-rollout-unit-rerun.log). The full unchanged unit suite was not repeated after this test-harness-only repair.
- Production TypeScript/build, credential pattern checks, lint and architecture passed. Existing lint cleanup-ref and bundle-size warnings remain. No Firestore rules/schema changes, so rules/auth-recovery suites not repeated.
- Live provider semantic checks and physical keyboard behavior remain unverified; this rollout does not claim those limitations resolved. AGENTS.md and PROJECT_ENGINEERING_GUIDELINES.md applied; the referenced university knowledge file is absent.

Previous hosting manifest: .wrangler/public-rollout-release-before.json. Previous worker 4b4503ea-1384-49c6-9f4c-25d86d3bfcad. Rollback uses previous Hosting and worker versions. Publication byte evidence appended after hosting deploy.

Published: wilo-public-final-20261104 for all signed-in accounts. Hosting deployment succeeded; all 14 checked production files match local build bytes. Evidence: 2026-11-04-public-rollout-production.json. Worker rollout and binding-preservation proof recorded above.
