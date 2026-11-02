# Search identity — 2026-11-03

The screenshot shows Google selecting the site name “Google” and a generic favicon, while the page title correctly identifies Where I Left Off. Inspection of production confirmed that the canonical URL, preferred WebSite name, og:site_name, crawlable robots rules and a valid192px square PNG favicon already existed. The precise reason for Google's selection is not established by this inspection.

Added stable WebSite @id and alternateName values WILO and ويلو to strengthen the existing identity without changing the visible interface or sign-in. The preferred name remains Where I Left Off.

Verification: production build and TypeScript passed; built JSON-LD parsed and checked; PNG dimensions verified; Hosting deployed; downloaded production index matches the build and contains the new metadata. No application behavior changes or full application test rerun for this metadata-only edit.

Google Search Console recrawl has NOT been requested by this task. The owner should use URL Inspection on https://where-i-left-off.web.app/ and Request indexing. Google's displayed name/favicon and update timing remain controlled by Google; publication does not prove the search result has changed.

Release: wilo-site-name-20261103. Existing security and account-linking release metadata preserved. No Worker, rules, Auth domain or user-data changes.

Official sources:
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/favicon-in-search
