# Loading cleanup — 2026-11-10

Removed Wilo left-edge back gesture, feedback and horizontal overscroll override. Pull-to-refresh remains phone-only. Native OS/browser gestures are outside application control.

Inline CSS hides the public identity footer during bootstrap and both footer areas whenever the shared loading screen is mounted. Links remain unchanged after loading, including multilingual guides and privacy/terms/support.

Verified: TypeScript; 9 focused unit/application tests; 9 Chromium browser tests (actual touch pull/reload, horizontal swipe leaves route unchanged, desktop unaffected, 3-language phone/desktop footer navigation and delayed bootstrap/footer restoration). Browser loading-state test uses actual delayed initial scripts and a mounted loader marker for subsequent state transitions. No physical-device test performed. No backend/data/auth/Push changes or production account writes.

Lint, architecture, credential-pattern check and production build are required before release. Production read-only evidence and rollback baseline stored outside Git at /home/adam/wilo-recovery/20261110-loading-cleanup. Existing SECURITY.md audit limitations remain applicable.
