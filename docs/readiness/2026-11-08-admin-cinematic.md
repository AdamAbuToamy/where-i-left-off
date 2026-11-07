# Admin cinematic experience — 2026-11-08

User approved admin-first delivery. Release: wilo-admin-cinematic-20261108.

## Reference review

Both videos were reviewed through full transcripts and storyboards. The short login example emphasizes one primary action, a coherent scene, nested corners, shadows and micro-interactions. The Flutter example warns against starting requests during rendering and hiding retained data during refresh. Its principle was applied to React, without importing Flutter patterns.

## Result

- An isolated login rehearsal in Admin → Preview entrance. Landscape, animated path, dimensional card entry and a sample arrival card. It has no authentication or persistence collaborators. Public signed-out login stays unchanged pending approval.
- Verified-admin page-entry motion and button feedback. No delayed navigation, heavy graphics library, snapshots of account data or persistent background animation. Respects reduced motion.
- Synthesized short press, navigation and drop sounds. Trusted gestures only, throttled, no typing/hover/scroll sounds, media downloads, microphone or loops. Lazy AudioContext, cleanup on disable/unmount/account change; disposal suppresses a pending resume.
- Sound/motion switches in Settings → Motion & sound and the admin preview. Per-account preferences on this device, retained across reload; no claim of cross-device sync.
- Stable catalog effect dependencies. Parent renders do not refetch. Same-query refresh retains results; different queries/types hide stale matches. Cancellation and domain validation remain intact.

## Isolation

Concurrent Moodle changes appeared during this task and were preserved. Tests/build used an archive of base commit 2ea1144 plus only this task's files in .wrangler/cinematic-release. Moodle, Worker, rules and provider settings are excluded from this publication.

## Verification

- Isolated full unit suite: 1309 passed, 132 files.
- Focused audio/catalog: 9 passed, covering lazy creation, throttling, dispose-during-resume, unsupported audio, stable requests, refresh retention and query isolation.
- Isolated browser set: 5 passed: admin desktop/phone, ordinary-account isolation, registration-age guard, repeated navigation.
- Final strengthened cinematic browser rerun: 3 passed in 19.4 seconds. Real Chromium AudioContext instrumentation confirms no autoplay before interaction, oscillator start after gesture, close and no further starts when muted. Also covers preference retention, reduced motion and no auth request from preview.
- A phone screenshot exposed internal focus scrolling with overflow:hidden. Changed the decorative scene to overflow:clip; added zero internal-scroll and brand-position assertions; both viewport journeys passed and corrected screenshots were inspected.
- Isolated TypeScript, lint (zero errors/warnings), architecture (29 modules, zero violations), production build, credential scan and route-bundle checks passed. Final build follows browser tests. Existing large-chunk warning remains.
- Rules, backend and auth-recovery suites not rerun: no corresponding code/config changes in this isolated release. The referenced university knowledge rules file is missing and was not claimed read.

## Limits

Chromium emulation, not physical iOS/Safari or a headphone listening-quality test. Browser/OS policy can mute audio; failure never blocks an app action. Login is a visual rehearsal, not another sign-in method. No new packages or paid assets. Hosting-only publication; deployed asset proof saved separately. Catalog refresh improvement is shared behavior without API/schema changes.

Sources: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow).

Delivery: Hosting release verified against all 63 built JS/CSS and shell/config files. READY for the approved admin preview; public login is not promoted.
