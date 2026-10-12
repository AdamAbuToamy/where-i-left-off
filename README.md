# Where I Left Off · وين وصلت؟ · איפה עצרתי?

**Experimental beta.** Save a link, record where you stopped, and return to the next step.

Live site: https://where-i-left-off.web.app/

## What it does

- Personal cards, sections, follow-up dates, weekly view, checklists and saved links.
- Arabic, Hebrew and English, responsive layout, keyboard/mouse/touch sorting.
- Google or email/password sign-in through Firebase Authentication.
- Offline card edits stored on the device, synchronized when the app is open again online; explicit conflict resolution.
- Shared groups: managers assign tasks and control members' creation permissions. Members update their assigned work.
- Expiring invitations, member removal and group deletion. Personal cards remain private.
- Limited admin dashboard: account activity metrics and app-access suspension. No access to personal card contents; no Firebase Auth account deletion.
- Installable web app and an unpacked Chromium extension for saving the current tab.

## Development

Requires Node.js 24, npm and Java 21 for emulator tests.

```bash
npm ci
cp .env.example .env.local
# Fill the four public Firebase web configuration values in .env.local.
npm run dev
```

Enable Google and Email/Password providers and Firestore in your own Firebase project. Client configuration is not an admin credential; Firestore rules enforce access. Never commit service-account keys or tokens.

For local demo data without production credentials:

```bash
npm run emulators
# In another terminal:
npm run dev:emulator
```

## Verification

```bash
npx playwright install --with-deps chromium
npm run test:all
```

`npm test` runs unit tests only. `npm run test:rules` starts a Firestore emulator and executes security tests. `npm run test:e2e` uses Auth and Firestore emulators plus Chromium. `test:all` finishes with a production build, so an emulator bundle is not accidentally deployed. Do not run build and E2E concurrently.

Read [TEST_RESULTS.md](TEST_RESULTS.md) for actual results and [SECURITY.md](SECURITY.md) for limitations. GitHub Actions runs checks on pushes and pull requests; it does not deploy or need production credentials.

## Known limits

Dependency audit has unresolved findings. This is not a security-certified release. Google popup login and native installation/share sheets need real-device checks. Offline data remains on devices that have already downloaded it; revocation blocks future server access but cannot remotely erase an offline device. Group administration needs an internet connection. No AI integration, automated external reply monitoring or binary file uploads.

Use Firebase free quotas without attaching billing if a zero-cost deployment is required. Availability is limited by those quotas.
