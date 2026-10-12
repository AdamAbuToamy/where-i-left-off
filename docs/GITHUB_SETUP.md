# Repository presentation and V1 release

Suggested description:

> Multilingual project organizer with offline sync, private workspaces, shared groups and conflict resolution. React, TypeScript, Firebase and PWA.

Website: https://where-i-left-off.web.app/

Suggested topics: react, typescript, firebase, firestore, pwa, offline-first, rtl, arabic, task-management, playwright.

## Repository visibility

Check Settings → General. If portfolio visibility is desired, review the tracked source for credentials and personal information, then use Change repository visibility to make it public. The repository's existing admin allowlist contains an email address; public visibility also exposes all retained Git history. A staged-file guard is not a complete history scanner. Do not change visibility without reviewing the intended public content.

## Create the V1 release

After the documentation commit passes CI:

1. Open Releases → Draft a new release.
2. Create tag `v1.0.0` against the tested documentation commit on main.
3. Title: `Where I Left Off V1 — links, checkpoints and next steps`.
4. Paste docs/RELEASE_V1.md as the body.
5. Mark **Set as a pre-release**, because the documented product status remains experimental beta.
6. Publish when the title, target commit and body match.

If GitHub CLI is already installed and authenticated, the equivalent is:

```bash
gh release create v1.0.0 --target main --prerelease \
  --title "Where I Left Off V1 — links, checkpoints and next steps" \
  --notes-file docs/RELEASE_V1.md
```

The web app uses the live hosting URL. GitHub source archives do not install it on a phone. The Chromium extension is unpacked source, not a Chrome Web Store release.

## Screenshots

Add real, current screenshots of mobile cards, a desktop/weekly view and group task assignment. Use a demonstration account and fictional cards, remove personal identifiers and capture the actual app. This documentation update does not include invented product screenshots.
