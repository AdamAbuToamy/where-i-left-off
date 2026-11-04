# Administrator toolbar hover refinement — 2026-11-04

## Behavior
- Desktop view/filter/section controls keep independent, non-shrinking hit areas. The command strip can wrap instead of overlapping at narrower desktop widths. Phone grid layout is retained.
- Filter and section selectors open immediately on mouse hover (desktop wider than 600px). Pointer leave uses a 220ms crossing grace period, cancelled on entering the list. Mouse clicking an already-hovered trigger does not immediately close it. Touch and keyboard behavior are retained.
- A small open-menu event coordinates existing selectors and More: opening another closes the previous popup. No model, saving or permission behavior is involved.
- More remains a three-dot trigger while open, without an overlaid native tooltip. Its panel has two compact actions: export PDF and section management. The repeated task-summary heading/count and second section selector are removed from the administrator menu.
- Section management expands on hover and keeps editor state mounted. Closing More collapses its disclosure without discarding form values. Ordinary-user controls retain their default variants.

## Evidence
- TypeScript passed. Lint zero errors, one pre-existing AssistantWidget cleanup-ref warning.
- Production build and source/dist credential pattern checks passed. Existing Firebase/main chunk warnings remain.
- Five affected unit tests passed across three files (`.wrangler/hover-controls-unit.log`).
- Three Chromium emulator journeys passed (`.wrangler/hover-controls-browser.log`): full phone bottom-bar/swipe/add/edit/detail regression; direct desktop view/filter/section and no desktop phone prompt; mouse hover, pointer transfer into options, mutual popup exclusion and pairwise non-overlap checks in Arabic at 1100px width.
- Actual Arabic resting-state screenshot inspected: `.wrangler/hover-controls-rtl.png`.
- Initial build exposed an incorrectly prepared CSS file. It was restored from the existing baseline and only the intended toolbar overrides reapplied before the successful build and browser checks.
- Backend/rules/authentication schemas were not changed; those suites were not rerun for this presentation-only refinement. No physical-device check or production-account fixture writes.

## Scope and delivery
Verified administrator preview only. PROJECT_ENGINEERING_GUIDELINES.md applied; no new dependency. Existing phone full-screen surfaces, account/model settings and worker are retained. Publication and byte-verification evidence are recorded after deployment.
