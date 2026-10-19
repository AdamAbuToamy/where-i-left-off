# Engineering and interface review — 19 October 2026

Reference revision: `20d9e804d0191437770a67a89cfcb52c68fa67b0`.

This change applies the supplied design video and *AI Web App Engineering Blueprint* to the existing React/Firebase application. The aim is a coherent product and reliable behavior. A visual style cannot establish who authored code.

## Implemented findings

| Finding | Change | Evidence |
| --- | --- | --- |
| Arbitrary alternating card colors, ornamental stripes, dotted background and raised shadows compete with project content. | Neutral surfaces, quieter borders and consistent controls; status badges retain meaningful state colors. | `App.css`, `ProjectBoard.css`, `Workspace.css` |
| Fixed input, language-picker and editor colors conflict with selected palettes. | Shared baseline tokens and palette-aware application surfaces, controls and hover states. All eight theme choices remain available. | `Themes.css`, `Workspace.css` |
| Completed checklist text is not struck through because the adjacent element is its number. | Apply completed styling to both subsequent text spans. | `Recall.css` |
| Application authentication/navigation and workspace orchestration share one module. | Extract `Workspace` with explicit props; retain existing offline queue, conflict handling, group permissions and routing. | `CloudApp.tsx`, `components/Workspace.tsx`; existing regression suite |
| Catalog UI reports an empty search during its debounce and can retain old matches. | Dedicated search hook with idle, loading, ready and error states; hide results immediately when the query changes; show empty only after completion; add retry. | `catalogLookup.test.tsx` |
| Old requests/selections can arrive after the title/type changes. | Abort on query changes/unmount and ignore cancelled responses, including cached requests. Scope selected titles to their resource type. | `catalogLookup.test.tsx`, `catalog.test.ts` |
| Third-party JSON is treated as trusted data. Null rows can crash rendering; malformed IDs/counts and URLs can enter card metadata. | Parse unknown payloads before constructing typed catalog records; validate envelope and per-source IDs; reject invalid rows; deduplicate; bound finite counts; validate HTTP(S) URLs and reject embedded credentials. | `catalog.test.ts` |

## Applying the blueprint to this stack

- Keep UI components, asynchronous orchestration and data parsing separate. Use React hooks for React state and the existing encapsulated `OfflineWorkspace` for queue/synchronization behavior.
- Treat external JSON as `unknown` until narrowed. Replacing it with an unchecked DTO assertion would weaken runtime safety. No `any` is introduced.
- Firestore rules remain the server-side authorization boundary. Client visibility checks are not a substitute. No production rules or access policies are relaxed in this change.
- Retain Firestore transactions, revision checks, mutation IDs and the local outbox. Replacing them with a custom HTTP envelope would add an API without solving a demonstrated problem.
- Retain centralized render-error handling and privacy-conscious structured diagnostics. No credentials or payload logging is introduced.
- Add regression tests for demonstrated failure conditions rather than classes, setters or inheritance solely to satisfy a pattern checklist.

## Validation

- `npm run build`: passed, including TypeScript and offline service-worker generation.
- `npm run lint`: passed.
- `npm test`: **107 tests passed across 30 files**. Eight additional regressions cover malformed payloads, unsafe URLs, cancellation, stale results, debounce/empty states and retry.
- `git diff --check`: passed.
- `npm run test:rules`: blocked before emulator startup. Installed Java is 17; firebase-tools requires Java 21 or newer. Existing GitHub quality workflow already provisions Java 21 and runs the rules and browser suites.
- Browser screenshots and desktop/mobile visual QA were not performed in this session: the supported browser QA capability is unavailable. Responsive CSS changes are source-reviewed, not visually certified.

## Remaining verification and observations

1. Run the existing Firestore and browser suites in CI, then inspect Arabic/Hebrew RTL and English LTR on phone and desktop in each palette. Verify focus, menu access, reorder, search and form editing.
2. The previously reported production Firestore 403/409/App Check issue has not been reproduced or resolved by this patch. It needs production configuration and request evidence; no claim of a live saving fix is made.
3. Vite still reports an approximately 1.06 MB uncompressed entry chunk. Route-level splitting can be evaluated separately; no unsupported performance improvement is claimed here.
4. Section deletion remains an offline sequence of project moves followed by section deletion. It is not a single cross-document cloud transaction. Any redesign needs dedicated conflict/retry and rule tests rather than a cosmetic refactor.

These changes are source changes for review. They do not deploy a new Firebase production build, establish production authorization correctness, or replace a comprehensive security assessment.

## Follow-up: OOP and credential boundaries

The subsequent OOP review supersedes the earlier architectural and local-rules-test status above:

- Introduced an immutable `ProjectEntity`, small storage/remote interfaces, separate IndexedDB/Firestore adapters, a composition root and a coordinator independent of Firebase. Removed the legacy parallel persistence implementations and the duplicate weekly date formatter. See `ARCHITECTURE.md`.
- Added shared client configuration validation, an explicit public-variable allowlist, before/after-build credential-pattern checks, and production deployment guards requiring real configuration and an App Check site key. Server-only test markers were absent from all built assets; deliberately unsafe public variables and missing protected-production configuration were rejected without printing values. See `CLIENT_SECURITY.md`.
- Reproduced two cloud-write failures on the emulator: unchanged defaults added to legacy group cards, and the rules' 1,000-expression limit for fully populated group cards with ten links. The adapter now preserves absent unchanged fields. Rule validators avoid repeated lookups/checks while retaining type, length, URL, ownership, membership, assignment and revision restrictions.
- Java 21 is now available for this review and real Firestore emulator tests run successfully. The final test counts are recorded in the accompanying delivery notes. The expanded suite includes malformed optional field rejection and fully populated cards with ten links, as well as legacy cards and idempotent replay.

This follow-up does not confirm the live project's API restrictions or App Check enforcement and does not publish the modified code/rules. Existing browser screenshot/E2E and production-verification limits still apply.

### Final verification for the OOP/security follow-up

- Build/TypeScript and ESLint: passed.
- Unit/component suite: **125 passed in 34 files**.
- Firestore emulator suite: **37 passed in 7 files**.
- Expanded group-adapter suite rerun after the final domain change: **12 passed**, including all optional card content fields and ten links.
- Credential-pattern checks for tracked/browser source and generated assets: passed.
- Deliberately unsafe public-variable and missing protected-production configuration builds: rejected as expected, without printing the test value.
- Server-only sentinel values absent from built assets; patch whitespace checks passed.

The tests do not contact or change the live Firebase project. Native browser screenshots/E2E remain unverified in this session.

- Source-archive credential-scan tests: operation without `.git` metadata and rejection of private material in public assets both passed.
