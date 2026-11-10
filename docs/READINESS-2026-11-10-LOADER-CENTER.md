# Stable loader centering — 2026-11-10

Shared bootstrap/React loader is fixed to the stable viewport (100svh) with symmetric padding and no flow margins. Header/title/notification controls cannot shift its center. Mobile overrides preserve the same geometry. Pointer events pass through to existing controls. Delayed bootstrap retry link stays at the bottom; footer loading visibility remains unchanged.

Verified: 3 Chromium browser tests (bootstrap/no-JavaScript fallback and delayed account verification), geometry assertions at 390/1280 widths, unchanged position after inserting a header, centered content group, Arabic/English/Hebrew, reduced motion and accessibility across five themes; 6 account lifecycle tests. Bootstrap screenshot visually inspected. Updated legacy language-switch test to use current segmented control as well as the older trigger. No account/data/backend/auth changes or live Push. Physical-device verification not performed.

Lint, architecture, credential pattern scan and production build required before release. Read-only production byte parity and recovery baseline recorded outside Git in /home/adam/wilo-recovery/20261110-loader-center. Existing SECURITY.md audit limitations remain applicable.
