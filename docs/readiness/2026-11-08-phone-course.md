# Phone course layout — 2026-11-08

Only <=760px admin University presentation changed. Removed the duplicated top course title and redundant course breadcrumb, aligned map/add/tools into one equal-height row, flattened the nested search field, made return-to-courses full width, and replaced horizontally clipped course tabs with a two-by-two grid. The retained course heading wraps long names at 18px with a compact edit/action row. Desktop styles remain unchanged.

Two Chromium Firebase-emulator journeys passed in 11.3 seconds, using a long English course name. Phone assertions verify no duplicate top title, a single action row, no horizontal tab overflow and heading size <=20px; desktop journey still passes. Final phone screenshot inspected. An initial regression assertion found a higher-specificity legacy phone rule overriding the tab grid; final scoped styles resolve it. Lint, types and production build/credential checks passed. No domain/data/backend changes; unit/rules/backend suites not repeated for CSS-only work. Real phone not physically tested. Existing bundle warning remains.

Release wilo-phone-course-20261108. Hosting only; admin trial retained.
