# Real sign-in, Google registration and search recovery — 2026-11-08

Release: wilo-real-entry-search-20261108. Supersedes the rejected stand-alone cinematic rehearsal.

## Requested behavior

- Removed AdminExperiencePreview, LoginScene and all landscape/mock-login styling. No fake account/card or studio preview remains in the product.
- Successful real email/Google entry emits a transient arrival cue. For the verified admin only, a 1.9-second full-screen WILO opening reveals the actual workspace. It is skippable, respects reduced motion and uses a native modal dialog for focus/background isolation. It does not delay authentication or save sample content.
- Actual page transitions and four quiet moving WILO watermarks follow the existing palette. Independent background, motion and sound controls live under Settings → Appearance. Preferences remain account-scoped on this device. Ordinary accounts do not receive the design experiment.
- Existing Google users go directly to the provider without an age question. Firebase additional-user information distinguishes a new account after provider authentication. Only an unfinished new Google registration asks for the existing 16+ self-declaration before opening the WILO workspace. Email registration still screens before collecting its details. No birthday scope, age inference from email or actual-age storage was added.
- Authentication presentation is held during the provider operation so Firebase's early observer cannot mount workspace subscriptions before the registration step finishes. An unfinished-registration recovery marker contains only a UID, not age/DOB, and survives reload on this browser. Cancellation signs out and does not delete account data. This client onboarding gate is not verified age assurance or a server-side cross-device eligibility policy.
- Assistant search URLs are consumed as one-shot intent. The query stays usable in the current view but is removed from the URL; reload/sign-in no longer replays it. Visible X buttons clear the query and return matching cards; Enter/Escape close the panel, and outside pointer interaction dismisses it. Other URL filters are preserved.

## Evidence

- Full isolated unit suite: 1313 passed in 133 files, 57.80 seconds. Google-entry checks include existing/new users, under-16 blocking, incomplete setup recovery and provider cancellation. The older Google-age test was updated to screen the explicit Create account path; it no longer encodes the rejected requirement to ask every Google login.
- Browser set: seven passed in 24.1 seconds: real admin arrival desktop/phone; ordinary-user isolation; registration age; repeated navigation; search deep-link consumption, Enter, Escape, X, outside dismissal and reload on both sizes.
- Native-dialog refinement: the three actual-entry/isolation journeys reran and passed in 13.2 seconds. This avoids competing manual inert ownership with the existing tour/modal system. Screenshots of the actual opening were inspected.
- Authentication recovery emulator: four passed. Provider behavior for the new Google branch uses injected SDK results in unit tests, not a real Google account login. No claim of live Google-provider verification.
- Isolated lint, architecture, TypeScript, production build, route separation and credential patterns checked. Existing large-chunk warning remains. Rules/Worker suites not rerun because neither was changed by this release.

## Delivery boundaries

Source/build isolated at /tmp/wilo-auth-search-20261108 from commit 7460bb2 plus this task's changes. Concurrent Moodle/Worker work was preserved and excluded. Production build follows browser builds; Hosting-only deployment. No backend, rules, provider keys or account records are migrated. Prior cinematic staging evidence moved from the project tree to /tmp/wilo-cinematic-evidence-20261108 to avoid nested lint configuration discovery.

Physical mobile keyboards, iOS/Safari and a headphone listening test were not performed. Existing sound synthesis and cleanup remain; no new audio downloads or microphone use. The referenced university knowledge rules file is still missing, not claimed read.

References: [Google's normal OpenID profile/claims](https://developers.google.com/identity/openid-connect/openid-connect), [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firebase additional user information](https://firebase.google.com/docs/reference/js/auth.additionaluserinfo).

Hosting publication completed; deployed shell/config and every JS/CSS asset were compared byte-for-byte with the isolated production build. See the adjacent production proof. READY for the requested functional fixes and admin-only visual trial.
