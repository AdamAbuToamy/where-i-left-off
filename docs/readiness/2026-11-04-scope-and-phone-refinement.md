# WILO scope and phone layout refinement — 2026-11-04

Decision: READY for administrator UI acceptance. Live-provider semantic acceptance remains BLOCKED on the local test key; do not claim live scope compliance passed.

## Changes
- Shared conversation and workspace policies restrict Wilo to organizer capabilities, greetings and site help. Unrelated code generation, homework solving and articles are excluded, including offering to turn an unrelated answer into a card/download. A dedicated decline_out_of_scope tool returns a fixed localized app reply, ignores untrusted model prose and never loads or writes account data. Strict empty arguments and one-call routing remain validated. Greetings and site actions retain existing routes. These assistant instructions are shared between desktop and phone; the UI refinements remain administrator-gated.
- Phone new-card form now explicitly declares RTL/LTR. Fixed a real cascade conflict: the later-loaded base grid style overrode the weak flex form rule, producing content-sized narrow fields in Arabic despite a full-width outer form. The scoped flex rule now wins; children stretch, the date/section stack consistently, controls stay within the viewport, and Next step uses a smaller textarea. Arabic browser assertions verify input width >340px on a 390px viewport, not just the outer form bounds.
- Phone University: courses and schedule are the two primary tabs. Map and overview are inside Plan tools; course management, schedule filters/build/add actions, and export/notification help are collapsed groups. Existing actions and persistence remain accessible. Desktop/public layout variants remain available.

## Evidence
- Full unit suite: 1281/1281 in 124 files passed (.wrangler/mobile-refine-unit.log). Final focused University/form rerun: 15/15 (.wrangler/mobile-refine-focused-unit.log).
- Backend unit/contract suite: 890/890 passed (.wrangler/mobile-refine-backend-final.log), including fixed decline responses, invalid arguments, normal greetings/site routing, deployment fixture dependencies and bounded context payload. The 11000-character greeting budget was preserved by reducing duplicate prompt prose rather than relaxing its test.
- Browser: four complete emulator journeys passed (.wrangler/mobile-refine-browser-final.log): internal phone tools/course navigation/save, desktop University and mobile schedule/UML persistence, ordinary account compatibility. Arabic phone form/University journey passed after final cascade fix (.wrangler/mobile-refine-arabic.log). Mobile full-screen add/edit/navigation also passed in the initial run before a separate newly nested-summary selector was corrected.
- Actual Arabic screenshots inspected: .wrangler/rtl-card-refined.png, .wrangler/rtl-university-refined.png. No physical handset check performed.
- Live-provider check attempted synthetic prompts only, zero production writes. The old local suite key returned HTTP200 zero-token billing notices, not model answers. Classified as BLOCKED provider-zero-token-billing-notice, not passed or a model-quality failure (.wrangler/scope-live-results.json). No key, prompt or account content is logged in diagnostics. The user's encrypted production account connection was not altered.
- TypeScript production build, source/dist credential pattern checks, lint and architecture passed. Existing AssistantWidget cleanup-ref warning and bundle-size warning remain.
- No rules, storage schema, auth settings or worker deployment. Rules/auth-recovery suites not repeated for these presentation/prompt changes. The shared prompt helpers are compiled into the browser's existing account-completion path.
- AGENTS.md and PROJECT_ENGINEERING_GUIDELINES.md applied; docs/knowledge/university/university_rules.md remains absent.

## Delivery
Hosting only. UI administrator preview; assistant product-scope instructions shared on desktop/phone. Preserve provider, account keys, model and worker metadata. Previous release: .wrangler/mobile-refine-release-before.json. Physical keyboard behavior and live model compliance remain unverified. Rollback via previous Firebase Hosting release.

Published: wilo-scope-phone-refinement-20261104. Hosting deployment succeeded; all 14 checked production files matched local bytes. Proof: 2026-11-04-scope-phone-production.json. Live provider remains blocked on the local test key, not marked passed.
