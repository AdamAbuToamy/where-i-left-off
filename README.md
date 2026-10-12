# Where I Left Off · وين وصلت؟ · איפה עצרתי?

A personal project workspace built with React, TypeScript, Vite, Firebase Authentication and Firestore. Keep the next step for each project, reorder cards and resume from another device.

Start with **[START_HERE_AR.md](START_HERE_AR.md)** for the Ubuntu update, Firebase Spark setup and optional HTTPS deployment.

## Features

- Google or email/password authentication; password reset.
- Projects scoped to the signed-in UID, enforced by Firestore rules.
- Live synchronization between sessions, loading/saving/error feedback.
- Create, edit, delete, activate, search and filter projects.
- Mouse, touch and keyboard sorting with persisted positions.
- Arabic, Hebrew and English; RTL support and reduced-motion styles.
- Transaction revision checks preserve newer edits when two devices conflict.

## Quick start

```bash
npm ci
node scripts/setup-firebase.mjs
npm run dev
```

Enable Google and Email/Password in Firebase Authentication, create the default Firestore database and deploy `firestore.rules` before using real accounts. See the Arabic guide. Use Spark without attaching billing. Free quotas are finite; this is not a promise of unlimited hosting or database usage.

## Tests

```bash
npm test
npm run test:rules
npx playwright install chromium
npm run test:e2e
npm run lint
npm run build
```

The emulator commands use a `demo-` project and never your production data. Java 17 or 21 is required by the pinned Firebase CLI 14 series. Browser tests build an emulator bundle; run a normal `npm run build` before deployment. See `TEST_RESULTS.md` for executed checks and limitations.

## Data design

Each project is stored at `users/{uid}/projects/{projectId}`. A snapshot subscription reflects changes. A move updates only the moved project's numeric rank. Equal ranks have a deterministic ID tie breaker. Content edits and deletes check the revision captured when the editor or confirmation opened. Concurrent moves use last successful write semantics. There is no global collection query or shared document containing all users' projects.

This version does not persist offline drafts or include AI integrations. The initial demo cards in the uploaded app existed only in component memory; new cloud accounts begin empty.
