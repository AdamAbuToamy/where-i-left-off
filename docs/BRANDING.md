# Wilo app identity

The owner-supplied original is `assets/branding/wilo-document-tracker-source.png`. The app icon uses only the upper document symbol, without the lower wordmark. `node scripts/generate-brand-icons.mjs` regenerates the exact raster crop and browser/iOS/PWA derivatives using the existing canvas development dependency. No generative redraw is involved. Review crop coordinates if replacing the original dimensions.

Published assets: favicon.png (96), favicon.ico (16/32/48/96), apple-touch-icon.png (180), app-icon-192.png, app-icon-512.png, and a separately padded app-icon-maskable-512.png. All PNGs are opaque. The old favicon.svg URL embeds the new icon for compatibility. index.html and the public about page link the new favicon; the manifest declares separate any/maskable purposes. App identity/start URL/share target and the textual site name are unchanged.

2026-11-09 verification: inspected the extracted 512px symbol visually; checked dimensions, opacity and ICO entries; SEO/lint/TypeScript and production-build checks apply. Final publication should compare remote bytes/manifest links. These checks do not establish Google recrawl timing or refresh icons already cached by physical iOS/Android devices. Google guidance: https://developers.google.com/search/docs/appearance/favicon-in-search .

## Installed Android identity updates

The manifest URL, id and start_url remain stable. Icon generation now emits content-hashed PNG copies and updates manifest icons.src so Chrome can detect changed artwork (Chrome 144 compares icon metadata/URLs). The service worker fetches the manifest network-first, preserving cached-manifest fallback offline. Hosting asks browsers to revalidate this metadata. Favicon URLs stay stable for search crawlers. No service worker registration, user cache, browser storage, account session or app identity is reset. Chrome may require the device owner to review/accept a significant icon change; publication is not proof that a physical launcher has applied it. See https://developer.chrome.com/blog/improvements-to-web-app-updates .

Local verification for this follow-up: three focused service-worker tests passed, including fresh online manifest retrieval and offline fallback; TypeScript/lint/SEO checks passed. Installed launcher update remains an owner/device action, not a result proven by publishing files.
