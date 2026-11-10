# Public discovery and deployment

`index.html` has descriptive metadata and a small public fallback until React mounts. The public guides are `public/about.html` (English), `public/about-ar.html` (Arabic) and `public/about-he.html` (Hebrew). They never query or embed user data. Existing authentication and database access rules are unchanged.

The preferred product name is **Where I Left Off**, with alternate names **WILO**, **ويلو**, **أين وصلت**, and **לאן הגעתי**. Keep these in the homepage WebSite JSON-LD and in visible public copy. The compact static identity footer is outside React's root so it remains readable before and after mounting and with JavaScript disabled. It shows the logo, product names and three guide links in the interface language. Longer explanations belong in the public guides. These are product names, not a guarantee of search rankings for generic phrases.

The current illustrated logo is stored in `app-icon-192.png`, `app-icon-512.png`, `favicon.png` (96px), `favicon.ico`, and `apple-touch-icon.png` (180px). Keep the favicon URLs stable. The homepage advertises the PNG/ICO favicon and the Apple icon; social metadata references the 512px product icon. `npm run check:seo` validates dimensions, icon availability, alternate names and visible public identity. Google selects its displayed site name and favicon and must recrawl/process changes before its result can update.

The homepage is the workspace entry; the about pages are distinct public guides with practical examples and questions. Each translated page has its own complete content, `lang`, `dir`, localized metadata and self-referencing canonical. Reciprocal `hreflang` links identify English, Arabic, Hebrew and English as `x-default`; the original `/about.html` URL remains the English canonical. Keep guide links and language navigation available without JavaScript. `lastmod` is the date of an actual public-content change, not the date of each build. Current dates reflect the content revision on 2026-11-10. Public HTML revalidates; hashed application assets retain long cache lifetimes.

Maintain the guides through `scripts/about/content.json`, `scripts/about/layout.css`, `scripts/about/card.css`, `scripts/about/demo.js` and the shared `scripts/generate-about.mjs` template. Run `npm run generate:about` after changes. `npm run check:about` and the prebuild gate reject stale generated pages, keeping English, Arabic and Hebrew structurally consistent. Do not edit one generated HTML page independently.

The public fictional weekly-planning card is server-rendered from the actual `CompactCardShell` presentation component with its design context enabled. It does not instantiate Firebase, read accounts or save data. Its small browser script only opens/closes the inline fictional preview and manages keyboard focus. Keep the scoped card rules aligned with App.css/designPreview.css when the application card design changes. Public examples must not use the owner's personal projects.

Generation emits content-addressed `about-guide-*.css` and `about-demo-*.js` assets and updates all three pages. These assets have immutable Hosting cache rules; retain prior published hashes and legacy `marketing.css` for cached HTML. Separate asset URLs prevent older service workers from pairing new markup with incompatible cached CSS/scripts. Current guide HTML, CSS and preview script are included in the versioned offline shell, with navigation fallbacks for all three locales. The compact preview remains readable without JavaScript; opening it requires its small local script.

After every Hosting publication, run `npm run check:seo:live`. It compares production metadata, aliases, guide links, sitemap and logo with this checkout and checks direct 200 responses, canonical URLs and HTML revalidation. A failure means the current release needs investigation, not that Google's index state is known. A later deployment from an older checkout can otherwise remove newer public identity work, as observed on 2026-11-10. Publish from a checkout containing these changes and retain the previous Hosting version for rollback.

`public/robots.txt` and `public/sitemap.xml` are real static files copied by Vite into `dist`. Firebase Hosting serves them before the SPA catch-all rewrite. Only `/`, `/about.html`, `/about-ar.html` and `/about-he.html` are listed; private workspace URLs and invitation tokens must not be added to the sitemap. The legacy text sitemap must list the same URLs.

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

## Deployment from GitHub Actions

`Deploy Firebase Hosting` can publish the existing `production` hosting target without a local Firebase login. It uses the existing `FIREBASE_SERVICE_ACCOUNT` repository secret already referenced by the account worker. That identity must also have Firebase Hosting deployment permission; the workflow does not grant itself additional permissions. Missing credentials or insufficient permissions cause a failed deployment, rather than a claim of success.

The workflow recovers only public browser configuration from the current live site, verifies the project ID, and preserves the current public reCAPTCHA Enterprise site key. It stops when it cannot preserve App Check. The generated `.env.production.local` is ignored and removed at the end of the job. No private account or project data is read for this step.

For subsequent application changes, run **Actions → Deploy Firebase Hosting → Run workflow** after checks pass. Pushes changing the hosting workflow or its configuration preparation script also trigger deployment. The action deploys Hosting only; database rules, indexes, account workers and authentication settings are not deployed.
