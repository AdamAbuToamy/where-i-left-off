# Branded loading screen — 2026-10-28

## Scope
Replace the bare account-verification text with a dedicated WILO loading composition: existing palette and dotted background, animated organizer cards, bookmark motif, wordmark, localized heading and real status text. Reuse it for the initial authentication wait and the lazy University page load. Keep the existing header, language picker, sign-out and legal links.

Presentation only: no added timers, minimum display duration, request delays, fake percentage, new dependencies, changes to authentication/deletion authorization, caching or data writes. Decorative visuals are hidden from assistive technology; the actual status uses a polite status region. CSS stays scoped to the component and honors reduced motion. Arabic/Hebrew RTL and English LTR are supported; existing selected themes supply all colors.

## Verification
The browser journey delays only the local emulator listener to inspect the pending state, checks desktop/phone layouts, language changes and reduced motion, and runs scoped axe WCAG2/2.1 AA checks for the original, ocean, violet, sunset and rose themes. It then releases the listener and confirms real account content replaces the loader. Desktop/mobile screenshots were visually reviewed.

The lifecycle regression asserts content remains gated until the actual snapshot, then renders without an artificial wait. Existing offline and pending-deletion tests remain intact.

Final local and exact-head CI results are recorded before deployment. Browser fixtures and all data changes target disposable emulator accounts. Production checks are read-only. Physical-device and other-browser behavior are not newly certified. Reverting this release restores the prior loading text without changing account data or state.


## Local evidence
- `npm test`: 1131 passed / 95 files, including account verification, pending-deletion and offline regressions.
- Focused Chromium/emulator loading journey: passed; responsive screenshots, three languages, five scoped axe checks, reduced motion, and transition after actual verification.
- `npm run lint`: zero errors; one unchanged AssistantWidget ref-cleanup warning.
- `npx tsc -b`, `npm run check:architecture`, production `npm run build` and `git diff --check`: passed. Credential-pattern scan passed for 635 source/asset files; existing bundle-size advisory remains.
- Full browser suite, Firebase rules, auth-recovery, worker and dependency checks run in the exact-head CI gate. Results and live deployment evidence are linked from the release PR; they are not treated as passed before completion.
