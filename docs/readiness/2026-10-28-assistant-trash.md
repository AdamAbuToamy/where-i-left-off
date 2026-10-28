# Assistant personal Trash tools — 2026-10-28

## Root cause and implementation
The repository/domain already supported deleting trashed personal cards, but the native model catalog had no permanent-delete function and the reply contract rejected project deletes. Read catalogs omitted archive/trash markers, so a model could search for a card named “trash” and conclude that the collection was unavailable.

Add model-selectable `empty_trash` and `permanently_delete_card` functions. Code expands the former from the authorized personal snapshot, so the model does not need to invent IDs or ask for names. This uses general typed functions rather than recognizing individual prompt spellings. Keep the existing domain planner, immutable reviewed snapshot, revision/outbox checks, atomic transaction, review/Apply and final irreversible-delete confirmation. No production data is deleted by this release.

Allow only the specific project-delete reply branch with personal scope and empty values. The native single-delete adapter verifies the record is already trashed; the domain and persistence adapter recheck the existing constraints. Group scopes cannot widen the two personal-only tool schemas. Add actual card-state filters to bounded read queries and expose lifecycle markers/counts in catalogs. Filters precede name search and pagination. No account isolation or Firebase rules change.

Empty Trash produces a clear no-op reply. More than 50 proposed changes returns a clear limit response with no partial mutations; the existing atomic proposal bound remains. Active and archive-only cards, university records and group cards are excluded. Undo remains unavailable for permanent deletions. Newly trashed records after the reviewed snapshot are not silently added to the deletion set.

The production browser directly imports the shared native protocol for user-owned Pollinations requests; the Hosting bundle carries these changes. No new provider, credential or Cloudflare runtime configuration is required.

## Evidence
- `npm test`: 1134 passed / 95 files.
- `node --test push-worker/*.test.mjs`: 874 passed (7 new Trash tool/context cases). The schema regression now asserts the added personal-only empty-values branch while retaining typed-field constraints.
- Focused Chromium + Firebase emulator: passed. Actual isolated documents are reviewed, cancelled, then deleted after final confirmation. Active/archived cards and another account’s trashed card survive. A follow-up with the supplied Arabic spelling gets the empty-Trash response. This provider is injected; it verifies persistence and UI rather than model comprehension.
- Live Pollinations inference on synthetic snapshots: exact English and Arabic requests both generated the two correct personal Trash deletions through the real conversation client, native tool adapter and domain validation. No production writes. The empty case initially hit a provider timeout and passed on one bounded retry (zero changes, about 43 seconds); live-provider latency is not guaranteed by this feature. Private ignored result files contain no credential values.
- Lint: zero errors; existing AssistantWidget ref-cleanup warning remains. TypeScript, architecture, production build and credential-pattern checks passed (640 source/assets). Existing bundle-size advisory remains.
- Full browser/rules/auth/worker/dependency gates and published fingerprint evidence are linked on the release PR before delivery. Physical-device/store behavior is outside this verification.

## Recovery
Revert this release to remove the newly exposed functions. No schema/data migration. Reverting code cannot restore deliberately deleted personal cards; the existing final confirmation states that they cannot be recovered.
