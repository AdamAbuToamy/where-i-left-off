# Phone assistant launcher and change preview — 2026-11-02

READY for this scoped feature. Runtime commit 19e70e7.

## Behavior

On compact coarse-pointer/touch displays (width <= 767px, or landscape height <= 500px), the launcher follows a drag freely and snaps to the nearest of four viewport edges on release. Pointer capture, a six-pixel drag threshold and click suppression keep dragging from opening chat. Normal taps and keyboard Enter still open it. Arrow keys offer edge placement. Only normalized edge/ratio placement is stored locally, namespaced by account; corrupt values fall back safely. Resize/orientation and button-size changes recalculate the point; notch/home-indicator safe-area insets are respected.

The phone conversation fills the visual viewport, including height/offset updates from browser chrome/keyboard viewport changes. It uses safe-area padding, body scroll locking and a keyboard focus loop while full-screen. After an existing validated change is confirmed saved, or a successful control is executed, the panel animates to a small bottom header while the existing domain deep link/highlight reveals the result. The preview lasts 2.4 seconds after the target is rendered, then returns full-screen without destroying conversation or reopening the keyboard. A Return button restores it immediately. Closing cancels pending return timers; a missing DOM target has a ten-second presentation timeout. Reduced-motion preferences disable movement transitions. Tablet/fine-pointer desktop behavior follows the prior paths; simply narrowing a mouse-driven desktop does not activate phone dragging/full-screen behavior.

## Integrity and boundaries

No new provider requests, model prompts, planning permissions or persistence operations. Preview begins only after the original save/control result; streamed/proposed operations are never executed for presentation. The change-reveal callback observes the existing hard-coded domain destinations, not model-provided selectors. Geometry is pure and independently tested; drag/viewport persistence and temporary preview have separate UI hooks. The approved final design remains the only account design.

## Verification

- npm test: 1242 tests passed in 114 files. Focused geometry/reveal/widget run: 37 passed.
- Four Chromium journeys passed: phone/desktop rich conversation, stop and reduced-motion/accessibility checks; actual CDP touch drags to all four edges, no click-on-drag, placement after reload, full viewport, real saved card through injected provider/Firestore emulator, highlight, shrink/automatic return, manual close during preview, landscape resize; unchanged desktop placement/docking through save.
- After tightening the phone-only media condition, the two feature journeys passed again, including a narrow fine-pointer desktop exclusion assertion. These two are repeat checks, not additional unique journeys.
- Pure cases cover nearest edge, clamping, portrait/landscape normalization, small viewport, safe areas and invalid stored placement. Reveal callback test waits for the confirmed DOM target.
- TypeScript, lint (zero errors, one pre-existing requestGeneration cleanup warning), production build/credential pattern scan, route-bundle check and architecture (22 modules, no violations) passed.
- Phone full-screen and change-preview screenshots were visually inspected.

All authentication and saves in browser tests target disposable emulator accounts. Provider responses are injected; this does not measure live model quality or provider latency. Browser visual-viewport changes are handled in code, but real iOS/Android keyboard/notch hardware and physical devices were not exercised. Backend/rules/auth-recovery suites were not rerun because their code and data policies are unchanged. No production account writes or auth-domain/rules/worker changes occurred.

Hosting publication and exact assistant-bundle/index match are recorded separately in the adjacent production proof JSON. A previous Hosting release can roll back this UI without data migrations; launcher position is a local cosmetic preference only.
