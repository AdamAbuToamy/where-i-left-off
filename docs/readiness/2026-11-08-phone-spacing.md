# Phone title spacing — 2026-11-08

Phone-only admin trial: removed the University eyebrow, added 20px separation below the University title, and placed the real site brand/install spotlight physically left opposite the notification bell with a 24px grid gap. Header changes <=600px; University spacing <=760px. Desktop unchanged.

Two Chromium emulator journeys passed in 12.5 seconds, asserting title/action separation, hidden eyebrow, brand-left/bell-right geometry, long course name and existing editing/navigation. Phone screenshot inspected. The first run exposed shared emulator plan data between viewport tests; fixture now clears only the disposable user's local-emulator study records before each journey. Types, lint excluding transient browser artifacts, production build and credential checks passed. No domain/backend changes; full unit/rules/backend suites and physical-device checks not repeated. Existing bundle warning remains.

Release wilo-phone-spacing-20261108; Hosting only, admin trial retained.
