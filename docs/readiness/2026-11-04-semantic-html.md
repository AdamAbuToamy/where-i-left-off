# Semantic HTML application — 2026-11-04

Decision: READY for public semantic-structure update.

## Reference and scope
Reviewed the supplied 79.2-second WhatsApp video (17.04.33): meaningful HTML elements, header/nav/main/section, logical h1/h2/h3 order, and CSS controlling size instead of heading levels. Its closing request for video comments is source material, not an app instruction.

- The outer workspace is a layout div. Page header and legal footer are outside a single main landmark. Signed-out/setup/loading/support/account-route branches each supply one focusable main. Account-verification/deletion fallback can supply that landmark without wrapping already structured content or changing gate priority.
- Existing named nav elements and independent card articles remain. Unheaded layout-only project-grid/report containers use div, while titled sections retain section. University h2 remains accessible on phone while visually clipped; it is no longer removed from the accessibility tree.
- Added a localized keyboard Skip to content anchor. It focuses/scrolls the main without changing the hash route. Preserved root workspace CSS when changing its tag; no typography/layout redesign intended.

## Verification
- Two Chromium semantic journeys passed (.wrangler/semantics-browser.log), covering signed-out structure plus seven signed-in pages each on English desktop and Arabic phone: personal, university, settings, analytics, library, groups, support. One main/banner/contentinfo/h1, named navigation, no route mutation on skip, and targeted Axe rules for landmarks/heading order passed on 14 routed page observations. This is not a claim of complete WCAG compliance or improved Google ranking.
- Two current-flow Chromium regressions passed (.wrangler/semantics-regression-current.log): full-screen phone add/edit/details/current bottom navigation and desktop assistant applying a reviewed change. Injected provider/emulator persistence; no live account data writes.
- Focused unit tests: 10/10 across shell/navigation, account page, header and card presentation (.wrangler/semantics-unit.log), plus 6/6 account lifecycle tests (.wrangler/semantics-lifecycle-unit.log). Includes exactly one main through verification, loaded content and pending account deletion. No full unit-suite rerun for this bounded presentation-only change.
- Initial unfiltered legacy mobile-assistant journey failed waiting for the old phone side-navigation trigger, which is hidden by the previously published bottom-navigation design. That obsolete floating-launcher/side-menu journey was not changed or marked passed. Current phone bottom-bar/form journey was used instead. This pre-existing test maintenance debt remains recorded.
- TypeScript/production build and source/dist credential pattern checks passed; architecture 29 modules/no violations. Lint zero errors, existing AssistantWidget cleanup-ref warning. Existing bundle-size warnings remain.
- No backend, rules, auth settings, storage schemas, provider model/key or permissions changed. Backend/rules/auth-recovery/live-provider/physical-device checks not repeated. PROJECT_ENGINEERING_GUIDELINES.md and AGENTS.md applied; referenced docs/knowledge/university/university_rules.md absent.

## Delivery
Public Hosting-only rollout; worker 83abe814-b1d2-44e3-b749-90ac83bdb978 and all prior release metadata preserved. Previous manifest .wrangler/semantics-release-before.json. Roll back to the prior Firebase Hosting version if needed. Production byte proof recorded after deployment.
