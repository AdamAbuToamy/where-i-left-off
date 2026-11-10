# Guide targeting and signed-in landing — 2026-11-10

## Confirmed presentation defects
The guide queried a new-card form which remains mounted inside a closed inert reveal panel. It therefore selected a hidden title field before the user opened the form. Target selection now considers only an explicitly open reveal or active phone form, and updates after reveal transitions finish.

The thinking expression had an inverted smile and worried eyebrows; all instructional expressions now remain friendly. Phone-form heading styles leaked into the portalled speech bubble; scoped typography prevents the oversized heading. Redundant return navigation is hidden during creation. Guide buttons have explicit non-submit types, and browser coverage verifies minimizing/restoring a guide with a filled title does not submit or clear the form. Desktop placement can avoid the whole form; the phone keeps the current target clear.

## Signed-in landing
An authenticated non-admin on a persisted admin/logs route received a misleading sign-in-only outlet. The common auth presentation path now redirects forbidden admin routes and a bare site root to personal cards. Valid explicit deep links (including Continue Now, University, Settings, API docs) and group-invitation routing are preserved. No Google/Firebase authentication, authorization, App Check or data rules changed.

## Evidence
- Complete application suite: 149 files / 1374 tests passed.
- Browser emulator suite: 5 passed (root/admin/logs login landing and desktop/phone interactive tour). Additional final tour/visual pass: 2 passed, including form guidance, minimize without submission, and keep/delete isolation.
- Final focused accessibility/landing tests, lint, architecture and production build are release gates.
- Phone and desktop form screenshots visually reviewed. Physical handset and live Google OAuth were not exercised; shared post-auth routing was tested through email/password emulator login.
- No production account data writes, Push tests, backend changes or migrations are needed.

Recovery and production asset proof: /home/adam/wilo-recovery/20261110-guide-landing-fix/.
