# Original-interface preview readiness — 2026-10-27

## Scope and acceptance
Verified administrator experiment: `https://where-i-left-off.web.app/#/admin/preview`. The public UI remains the existing application. The rejected Studio route/UI is not restored.

- Original dotted background, warm surfaces, existing green palette and title/button language.
- Collapsible secondary tools, filters, section management and extra form fields; folding a form panel preserves its values.
- Lucide icons and interaction motion for menus/chevrons, page and course tabs, cards, ordering, completion, reminders, dialogs, toasts, assistant replies and actual waiting states. Reduced-motion preference changes are observed during a session.
- Compact university statistics, existing paginated course navigation, a clear selected-course marker, stable colors based on course ID, course-labelled deadlines and next-class context.
- Course overview/tasks/materials/study-plan/schedule tabs, semester creation/assignment/archive, linked notes and imported materials, paginated tasks/materials, phone day agenda and existing hourly week view.
- Private cards with search/filter controls, section editing, bulk actions, pointer/keyboard ordering, edit/archive/trash and undo.
- Contextual real-provider adapter, saved chats, ordinary conversation before workspace planning, complete reviewed proposals, atomic apply, cancellation and real file downloads. No guarantee is made about live-provider latency or all possible model requests.
- Private journal, account-copy read isolation, revisions/two-tab synchronization, bounded history, checkpoints, validated backups and corrupt-cache recovery.

## Verification
Local logs are stored in ignored `.wrangler/preview-*` files; CI repeats the checks on the exact PR and merged source. The final focused rerun covers the last ordering, semester and chat-validation refinements.

| Check | Evidence |
| --- | --- |
| Unit/application | 1166 passed across 98 files |
| Worker | 867 passed; backend source unchanged |
| Focused browser | Latest 6 passed, including actual account copy/import and pointer ordering |
| Full browser | 43 journeys passed before the additional copy/import case; that added case passed in the final focused run. CI runs all 44 on the exact source. |
| Rules and persistence | 675 passed across 14 files, Java 21/Firestore emulator |
| Auth recovery | 3 passed using Auth emulator |
| Lint | No errors or new warnings; one existing AssistantWidget warning |
| Types | `npx tsc -b` passed |
| Architecture | 7 roots, 20 runtime modules, no violations |
| Credentials | Source/dist pattern checks passed; not a comprehensive secret scanner |
| Production build | Passed, existing public bundle-size advisory remains |

Chromium tests check palette equality with the original green, private CRUD, folded form-value preservation, pointer ordering, undo/redo, two-tab synchronization, checkpoints, downloads, linked notes, topic completion, course-labelled tasks, local reminder feedback, semester archive, three languages/desktop and phone layouts, live reduced-motion changes, keyboard dialogs, axe WCAG2/2.1 AA, provider-injected compound proposals and cancellation, account isolation, validated account-copy/import, and malformed-cache recovery. Demo screenshots were visually reviewed. Live OAuth and model acceptance are a separate verification category.


The final focused rerun also verifies that a form opened before a second-tab update cannot recreate or overwrite the changed record. Persistence controls are disabled while a save is pending, including a palette change immediately after checkpoint creation. All six focused journeys passed after this correction.

## Limits and recovery
This is a browser-local trial. Copying account data is explicit and read-only; model requests use only the copied/demo snapshot. There is no write-back, cross-device experiment synchronization, real group invitation or phone reminder. Preview reminders are labelled accordingly. Calendar integration is an ICS download, not automatic Google Calendar sync. Model/provider tests are injected-response tests through the real adapter; a new 618-prompt live model run and manual Google/Pollinations consent were not performed. Physical devices, Safari/Firefox, store installation and real push delivery are not certified by Chromium/emulator tests.

Use Undo/Redo for the last twenty operations or save/restore a checkpoint. JSON export/import preserves the private dataset. A malformed cache can be exported before reset, which saves a recovery copy first. Failed writes never replace the existing journal. Exit via Back to administration. Source rollback is a normal PR revert through the quality/Hosting gate; no production data migration is involved.

The existing public bundle-size advisory and one pre-existing AssistantWidget lint warning remain. This change is not a comprehensive penetration test or certification that every historical code issue is fixed.
