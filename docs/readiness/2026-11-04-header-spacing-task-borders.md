# Header spacing and university task borders — 2026-11-04

Decision: READY for public correction on desktop and phone.

Root cause: App.css applied the page width/margins/padding to the main tag. The semantic change correctly moved main inward, but those old type selectors then padded the inner page while the outer header lost its spacing. Retargeted the original desktop and phone declarations to .workspace. Semantic header/nav/main/footer structure is retained; inner main is no longer double-padded.

University task cards now have a 2px near-black (#111) border, including hover, so individual tasks remain clearly separated. Existing layout, task actions and completion state remain.

Evidence:
- Five Chromium emulator journeys passed (.wrangler/header-spacing-browser.log). English desktop and Arabic phone audit seven pages each: header top/side spacing, no title/account-control intersection with the visible menu, main padding 0, single main/banner/footer, heading order and keyboard skip. University persistence/UML/schedule and ordinary-account compatibility also passed. Computed task borders verified 2px/rgb(17,17,17) at rest and hover.
- Inspected the actual generated desktop screenshot (test-results/university-only/uml-desktop.png) for restored outer header position. Fixture screenshots include emulator notices and may capture entry transitions; geometry assertions establish the requested spacing.
- Production TypeScript/build and source/dist credential checks passed. Lint zero errors, one existing AssistantWidget cleanup-ref warning. Existing bundle-size warning remains.
- Presentation-only fix: no unit tests mirroring CSS; no backend/rules/auth/provider/physical-device checks repeated. Account isolation, existing permissions, model/key configuration and storage paths unchanged. AGENTS.md and PROJECT_ENGINEERING_GUIDELINES.md applied; referenced knowledge file remains absent.

Hosting only for all users. Previous manifest .wrangler/header-spacing-release-before.json; rollback via prior Firebase Hosting version. Publication byte evidence appended after deploy.
