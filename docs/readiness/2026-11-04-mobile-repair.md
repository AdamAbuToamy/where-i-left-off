# Mobile interaction repair — 2026-11-04

Decision: READY for verified administrator preview; physical Android keyboard acceptance remains manual.

## Changes
- Reviewed the two supplied videos and four screenshots. Both MP4 attachments have identical SHA256 DF2B7E409F530044D71EF6A97410A335453A7581B0A42863917E15A5A9C4054D. Video frames show assistant opening, automatic keyboard focus and viewport jumps.
- Phone assistant no longer automatically focuses the composer on opening. Phone editing surfaces lock the underlying page, restore scroll on exit, and apply visualViewport geometry through one requestAnimationFrame without React rendering each keyboard animation event. Launcher repositioning pauses while chat is open. Existing confirmed-change peek remains.
- Touch navigation ignores null blur targets and mouse-leave behavior; bottom More is full-screen with Back. Navigation and language selection close it after actual activation.
- Administrator toolbar has one section selector with a management entry and a direct PDF action; redundant More panel removed. Section management reuses existing permission and revision-checked callbacks.
- Phone single-card mode starts near the controls, displays checkpoint, notes, checklist, links and progress where available, and retains swipe navigation. Compact mode and drag handles retained.
- Administrator add-card form on desktop/phone starts with title, next step, section and date. Notes/links and additional options are collapsed, mounted groups; existing validators and save path remain. Consistent field sizing, readable text, phone full-screen retained.

## Verification
- npm test: 1281/1281 across 124 files passed (.wrangler/mobile-unit-final.log). Initial failures from an omitted preview-context binding were fixed before this complete rerun.
- Chromium emulator journeys: 7/7 (.wrangler/mobile-browser.log); phone navigation/full-screen forms, touch menu activation, single-card content, synthetic visualViewport shrink/restore, direct desktop selectors/section-management dialog, RTL hover traversal, ordinary account navigation and notification regressions.
- Additional Chromium journeys: 3/3 (.wrangler/mobile-assistant-browser.log); phone draggable launcher, confirmed-change peek/restore, desktop assistant unaffected, phone add/edit/details. These use injected provider responses and emulator writes, not live provider credentials.
- Inspected actual generated phone form and swipe screenshots (.wrangler/mobile-add-repaired.png, .wrangler/mobile-deck-repaired.png).
- Architecture check: 29 modules, no violations. Lint/types/production build and credential scans recorded in final build logs.
- No backend, rules, auth schema or provider change. Rules/backend/auth-recovery suites not rerun for this UI-only change. Physical keyboard, IME and installed Android PWA behavior cannot be proven in desktop emulation and require handset verification.
- Knowledge path docs/knowledge/university/university_rules.md is absent; no claim of reading it. PROJECT_ENGINEERING_GUIDELINES.md applied. No dependencies added.

## Delivery
Hosting-only, administrator preview. Existing public feature gates, worker, provider config, account data and revisioned mutation boundaries preserved. Rollback: previous hosting release; original public UI retained by existing account gate.
