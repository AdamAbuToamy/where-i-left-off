# Horizontal sign-in title and entry sound — 2026-11-08

Where I Left Off stays on one horizontal line at desktop and phone widths, retaining the existing staggered reveal, palette and 3.4-second opening. The verified-admin trial remains in place.

A short synthesized three-note entry cue follows the account sound setting. A silent AudioContext is unlocked during the actual sign-in gesture before network/provider work, transferred only to the successful arrival, and disposed on cancellation, failure, mute, ordinary-account entry, skip or expiry. Audio failure never blocks authentication.

Verification: 16 focused unit tests passed (audio lifecycle, Google entry and registration eligibility). Three Chromium emulator journeys passed in 14.4 seconds, checking desktop/phone horizontal layout, real entry oscillator generation, settings persistence, reduced motion and ordinary-account isolation. Types, lint (excluding transient Playwright artifacts), architecture and production build/credential checks passed. The first lint attempt raced with disappearing browser trace files; the completed rerun passed. Existing bundle-size warning remains.

No backend, provider, model, Firestore rules or persistence changes. Full unit/rules/backend suites were not repeated for this scoped change. Google popup audio behavior, physical devices and subjective speaker sound quality were not manually tested. Browser audio instrumentation confirms synthesis, not audible output on every device. No unrelated untracked work staged.

Release: wilo-entry-wide-audio-20261108. Hosting-only deployment and production asset proof recorded separately.
