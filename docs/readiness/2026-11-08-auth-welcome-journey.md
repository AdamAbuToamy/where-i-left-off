# Welcome authentication journey — 2026-11-08

## User request and scope

Replace the crowded login/registration screen with a responsive welcome and sequential email/password questions, Google available immediately, a bottom account-mode switch, and legal/support links only in the footer. Base is the explicit motion revert `7a4a144`; the rejected scene effects stay removed. No new graphics layer or background animation.

## Implementation

- Login: email → password → existing Firebase sign-in. No account-existence lookup or provider request on email continuation. Wrong credentials stay retryable on the password step; email edit/back and password visibility controls are explicit.
- Registration: email → password → name/eligibility → existing Firebase creation/profile flow. No email account is created before eligibility; the neutral age choice and16+ eligibility invariant remain. Age/DOB/password are not saved in browser storage or diagnostics.
- Google opens directly from the first question in either mode. Existing users do not receive an age question; new Google users retain the existing pending-registration hold and must finish eligibility. Popup errors/cancellation and unfinished-setup recovery remain supported.
- Password reset uses the existing Firebase operation on the password step. Existing Auth, App Check, logging, account gates, provider popup timing, storage and server rules are unchanged.
- One welcome name, compact language selector, localized LTR/RTL, simple progress, heading focus instead of automatic keyboard focus, password-manager autocomplete hints and input font16px. Legal notice moved to the existing footer with its four existing links; no duplicated policy/about links inside the form.
- Small opacity-only question reveal; reduced motion disables it. No sceneMotion, orbit, native route snapshot, particle or layout-transform feature reintroduced.
- Existing browser login fixtures updated to perform the new email continuation; old backup artifacts untouched. Tests asserting an age-first form were adapted to the requested field order while retaining denial of ineligible creation and new-Google entry.

## Executed verification

- Full unit/application:1328 passed,136 files. Focused Google/eligibility13 passed.
- Browser on isolated5198/Auth+Firestore emulators:11 passed covering Arabic/English desktop/touch phone,320px overflow, single-question fields, footer-only links, back/edit, password visibility, failed and successful email authentication, actual synthetic registration, under16 denial, unchanged administrator entry/ordinary exclusion and callback cleanup. Axe WCAG2/2.1 A/AA found no violations within the tested welcome panel in four layouts.
- Additional password-reset/retry browser case passed after adding a real emulator reset assertion. Auth recovery4 passed. No real emails/accounts/production data modified by tests.
- Lint, TypeScript, architecture38 modules, diff/credential checks passed; production build/deployment evidence recorded separately by the operator.

## Limitations and rollout

Synthetic provider tests do not prove actual Google OAuth or a physical phone keyboard/password manager. Chromium phone emulation is not Safari/iOS verification. Prior broad CI browser failures on legacy navigation/hover assertions are not claimed repaired by this auth change. Worker, Firestore rules and schemas are untouched, so those suites were not rerun solely for the UI. Existing Vite large-chunk warning may remain.

This is the public pre-authentication surface, not an account-specific motion pilot. Preserve Firebase/App Check configuration when building and publish Hosting only. Match the release marker/asset hashes and perform anonymous email→password/back/Google-entry/footer smoke checks. Do not authenticate a real production account for smoke testing. Recovery is a normal revert/Hosting release; no database rollback.
