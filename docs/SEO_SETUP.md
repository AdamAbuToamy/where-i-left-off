# Public discovery and deployment

`index.html` has descriptive metadata and a small public fallback until React mounts. `public/about.html` is an independent, readable HTML introduction, linked from the sign-in screen. It never queries or embeds user data. Existing authentication and database access rules are unchanged.

`public/robots.txt` and `public/sitemap.xml` are real static files copied by Vite into `dist`. Firebase Hosting serves them before the SPA catch-all rewrite. Only `/` and `/about.html` are listed; private workspace URLs and invitation tokens must not be added to the sitemap. The service worker supports the new about page offline.

## Publish to the existing Firebase site

Use the project’s existing local `.env.local` configuration. Firebase web configuration is public; do not add service-account keys to Vite variables or source control.

1. Pull the latest `main` branch.
2. Run `npm ci --no-audit --no-fund` if dependencies are missing.
3. Run `npx firebase login` if necessary.
4. Run `bash scripts/deploy-seo.sh`.

This builds the full app and deploys **only hosting:production**, to the existing `where-i-left-off` site in `where-i-left-off-b5683`. It does not change Firestore rules or indexes. Never deploy a build made without the required Firebase web configuration; the app would display its configuration screen instead of allowing sign-in.

After publication check `/about.html`, `/robots.txt` (text/plain), `/sitemap.xml` (XML), and the main app's sign-in screen.

## Google Search Console

Add the URL-prefix property `https://where-i-left-off.web.app/`. Verify using Google's exact HTML file in `public/` (then redeploy), the supplied meta tag, or another method available to the account. Do not invent a verification token. Submit `sitemap.xml`, then use URL Inspection → Test live URL → Request indexing for `/` and `/about.html`.

Search Console ownership verification requires the owner's Google account. Deployment alone cannot submit indexing requests or guarantee search ranking.
