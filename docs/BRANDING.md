# Wilo app identity

The owner-supplied original is `assets/branding/wilo-document-tracker-source.png`. The app icon uses only the upper document symbol, without the lower wordmark. `node scripts/generate-brand-icons.mjs` regenerates the exact raster crop and browser/iOS/PWA derivatives using the existing canvas development dependency. No generative redraw is involved. Review crop coordinates if replacing the original dimensions.

Published assets: favicon.png (96), favicon.ico (16/32/48/96), apple-touch-icon.png (180), app-icon-192.png, app-icon-512.png, and a separately padded app-icon-maskable-512.png. All PNGs are opaque. The old favicon.svg URL embeds the new icon for compatibility. index.html and the public about page link the new favicon; the manifest declares separate any/maskable purposes. App identity/start URL/share target and the textual site name are unchanged.

2026-11-09 verification: inspected the extracted 512px symbol visually; checked dimensions, opacity and ICO entries; SEO/lint/TypeScript and production-build checks apply. Final publication should compare remote bytes/manifest links. These checks do not establish Google recrawl timing or refresh icons already cached by physical iOS/Android devices. Google guidance: https://developers.google.com/search/docs/appearance/favicon-in-search .
