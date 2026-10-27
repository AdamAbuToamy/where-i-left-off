# Branded loading screen — 2026-10-28

## Scope
Replace the bare account-verification text with a dedicated WILO loading composition: existing palette and dotted background, animated organizer cards, bookmark motif, wordmark, localized heading and real status text. Reuse it for the initial authentication wait and the lazy University page load. Keep the existing header, language picker, sign-out and legal links.

Presentation only: no added timers, minimum display duration, request delays, fake percentage, new dependencies, changes to authentication/deletion authorization, caching or data writes. Decorative visuals are hidden from assistive technology; the actual status uses a polite status region. CSS stays scoped to the component and honors reduced motion. Arabic/Hebrew RTL and English LTR are supported; existing selected themes supply all colors.

## Verification
The browser journey delays only the local emulator listener to inspect the pending state, checks desktop/phone layouts, language changes and reduced motion, and runs scoped axe WCAG2/2.1 AA checks for the original, ocean, violet, sunset and rose themes. It then releases the listener and confirms real account content replaces the loader. Desktop/mobile screenshots were visually reviewed.

The lifecycle regression asserts content remains gated until the actual snapshot, then renders without an artificial wait. Existing offline and pending-deletion tests remain intact.

Final local and exact-head CI results are recorded before deployment. Browser fixtures and all data changes target disposable emulator accounts. Production checks are read-only. Physical-device and other-browser behavior are not newly certified. Reverting this release restores the prior loading text without changing account data or state.


## Local evidence
- `npm test`: 1132 passed / 95 files, including account verification, pending-deletion and offline regressions.
- Focused Chromium/emulator loading journey: passed; responsive screenshots, three languages, five scoped axe checks, reduced motion, and transition after actual verification.
- `npm run lint`: zero errors; one unchanged AssistantWidget ref-cleanup warning.
- `npx tsc -b`, `npm run check:architecture`, production `npm run build` and `git diff --check`: passed. Credential-pattern scan passed for 637 source/asset files; existing bundle-size advisory remains.
- Full browser suite, Firebase rules, auth-recovery, worker and dependency checks run in the exact-head CI gate. Results and live deployment evidence are linked from the release PR; they are not treated as passed before completion.


## Compact screen controls and copy
Remove the specified resume introduction, analytics learning/books sentence, University slogan and repeated timetable editing/scroll/timezone hints. Keep routine successful University sync announcements available to assistive technology without occupying layout space; connecting, offline/queued, conflict and error states remain visible. Hide the task's repeated course label when one course is already selected; retain attribution in cross-course lists and the next-deadline summary. User course/task content is not deleted.

The sections bar is now a native disclosure, initially closed with the selected section in its summary. Mouse hover opens it and leaving closes it; touch and keyboard use the summary. Keep it open while section management is active to protect editing. Escape collapses it and returns focus. Account permissions and section saves/deletes are unchanged. The existing assistant change-reveal helper opens enclosing disclosures before focusing a confirmed saved record; this does not alter inference or execution.

Regression coverage includes mouse/touch sections, management, keyboard Enter/Tab/Escape, responsive layout and opening a saved section inside a collapsed ancestor. Existing section journeys now open the disclosure before using its controls.


### Final compact-UI validation
All 44 distinct Chromium/emulator journeys passed across the local runs. The first full run passed 33 then stopped at an old assertion expecting an expanded sections list on the second account. That assertion now explicitly opens the disclosure, and all 15 workspace journeys passed on the subsequent focused run. Mouse/touch/keyboard disclosure tests and the loader/theme accessibility journey passed. Exact-head CI re-runs the full suite together before merge.

Final unit count: 1132 / 95 files. TypeScript, lint (unchanged warning only), architecture, production build and credential-pattern scan passed. The collapsed sections desktop screenshot was visually reviewed.


### Hover/click regression
The first exact-head CI run passed 43/44 browser journeys and caught a mouse timing race: entering the summary opened it, then the native click could close it again. Mouse clicks now keep the hover disclosure open; touch and keyboard retain native toggling. All 16 repeated layout/disclosure journeys passed locally after the fix (three languages, desktop/phone, two runs). Repeated section tests use separate emulator accounts to prevent duplicate fixture records. TypeScript, lint and production build were rechecked before the final push.


### Native disclosure stabilization
A subsequent CI run again passed 43/44 and caught a delayed re-open after keyboard Escape. The picker now uses the native `details.open` property as its sole open-state authority instead of mirroring asynchronous `toggle` events into React state. Hover, Escape and confirmed-record reveal update that native property; touch/keyboard retain the browser toggle. All 20 mouse/touch/keyboard journeys passed in ten repetitions under CI mode. TypeScript, lint and production build passed again. The final exact-head CI must pass before publishing.
