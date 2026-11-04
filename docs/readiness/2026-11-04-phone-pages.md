# Phone simplification and opening performance — 2026-11-04

Decision: READY for administrator layout/function acceptance. NOT READY for a claim that physical Android keyboard stutter is eliminated; handset verification is outstanding.

## Delivered scope
- Removed the administrator phone single-card/swipe mode and its dedicated components. Compact cards and reorder handles remain.
- One small phone toolbar: new card, search, View tools. Week remains in bottom navigation. Status, filters, section management and PDF export remain accessible in an internal full-screen tools dialog rather than occupying the card list.
- More uses one vertical navigation column with full-width targets; duplicated Cards/University entries are omitted because bottom navigation already provides them. Existing account/language/sign-out actions remain.
- University phone view separates the course index from course details, including a Back-to-courses action and All tasks. Overview statistics are collapsed. Main tabs use short labels with full accessible names. Optional plan tools remain; import closes the disclosure. Success messages use compact expandable feedback. Desktop/public university behavior is retained.
- Phone opening: removed the overlapping CSS entrance animation and Motion scaling of the assistant, switched surface locking to layout effect and overflow without fixing/repositioning the entire document, stopped smooth message scrolling and transformed page ancestors. Keyboard geometry still uses coalesced visualViewport updates.
- A memoized board adapter forwards commands to the latest committed closures. Filter results are memoized with all data/filter/permission/date inputs. Opening a form no longer rebuilds every unchanged card. Repository revision/permission checks and mutation paths unchanged.

## Evidence
- Seven distinct Chromium emulator journeys passed (.wrangler/mobile-pages-browser.log): phone drag/peek/full-screen assistant, desktop assistant, full-screen card add/edit/details and touch navigation, separated tools/course index/details with closed-group save, desktop university persistence, mobile schedule/UML, ordinary-account university compatibility.
- After final presentation/performance refinements, the two directly affected phone journeys passed again (.wrangler/mobile-pages-final-browser.log). Actual generated Home/More/University phone screenshots inspected.
- Slow-CPU measurement is a Chromium simulation with 4x CPU throttling, dozens of cards and 30 frames per opening. Latest measurements are copied below. There is still one frame above 50 ms in each opening. This is not a physical-device or keyboard/IME measurement, and should not be called stutter-free.
- Initial test failures were repaired: removed-mode assertions were updated while preserving add/edit/full-screen/keyboard/navigation coverage; a desktop language selector assertion was scoped to avoid matching the hidden phone language control; missing university translations were added. The existing 17 university/navigation unit tests passed after those fixes.
- Final lint/build/full-unit evidence recorded before publication. Existing AssistantWidget cleanup-ref lint warning and large chunk warning remain.
- No backend, provider/auth credentials, Firestore rules or storage schema changed. Rules/auth-recovery/backend suites and live AI calls not rerun for this UI-only work. The knowledge file docs/knowledge/university/university_rules.md is absent; PROJECT_ENGINEERING_GUIDELINES.md applied.

## Opening frame sample
```json
{
  "cpuThrottle": 4,
  "assistantOpening": {
    "samples": 30,
    "maxMs": 112.05999999403957,
    "over50ms": 1
  },
  "addCardOpening": {
    "samples": 30,
    "maxMs": 71.06000000596032,
    "over50ms": 1
  },
  "physicalDevice": false
}
```

## Delivery
Administrator-only hosting update, preserving public feature gates. Previous release saved at .wrangler/mobile-pages-release-before.json. Rollback uses the previous Firebase Hosting version. Physical Samsung keyboard opening remains an acceptance item; do not claim it passed from emulation.

Final verification: all 1281 unit tests across 124 files passed. Lint zero errors, one existing warning; TypeScript production build, source/dist credential checks and architecture checks passed. No unperformed physical check is marked passed.
