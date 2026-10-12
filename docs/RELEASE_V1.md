# Where I Left Off V1

Save the link, checkpoint and next step in one card, and resume from another device.

Live app: https://where-i-left-off.web.app/

## Included

- Private personal workspaces, cards, custom sections, follow-up dates, checklists and weekly views.
- Arabic, Hebrew and English with responsive mobile/desktop layout.
- Firebase email/password and Google sign-in.
- Offline edits, cached reloads, reconnect synchronization and explicit concurrent-edit conflict choices.
- Shared groups, invitations, assignment and member creation permissions.
- Installable PWA, Android share-target declaration and an unpacked desktop Chromium tab-capture extension.

## Verification

The baseline `f0a16bc` passed both GitHub CI jobs. The suite includes 20 unit tests, 14 Firestore security/repository tests and 10 browser tests. The browser suite passed three consecutive local runs. Full-tree dependency audit reported 0 known vulnerabilities. Tooling compatibility, lint and production build passed.

## Status and limits

This is the first version of an experimental beta, not a security-certified or enterprise-ready product. Real-device installation/share sheets and real Google OAuth still need documented verification. Cached data cannot be remotely erased after revocation. No AI features, external reply monitoring, binary attachment uploads or external reminders are included.

See README.md, TEST_RESULTS.md and SECURITY.md for setup and evidence. No credentials or production user data are included in the release.
