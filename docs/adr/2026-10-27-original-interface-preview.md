# Original-interface experiment — 2026-10-27

## Context
The administrator rejected a replacement visual identity. The approved work is incremental improvement of the existing dotted, warm, green interface, available only on an experiment page. Existing public pages and account writes must retain their behavior.

## Decision
Expose `#/admin/preview` only to the verified administrator, via a lazy entry from Administration. Reuse the existing palette tokens, type and button styles, CourseNavigator, hourly Timetable, linked-text rendering, PDF exporter, domain planners, project entity and university validators. New CSS is scoped under `.admin-preview`; it does not replace `:root`, public navigation or normal page components.

The experiment owns a browser journal under `wilo-interface-preview-v1/<project>/<uid>`. Its repository receives explicit persistence, seed and clock collaborators. The outer localStorage adapter verifies the actual authenticated administrator on each access and uses Web Locks plus compare-and-swap revisions. Editors retain the journal revision from the moment they open, and persistence controls are disabled during a pending save. All actions, including a course edit and its semester assignment, validate before one journal write. Twenty undo/redo entries, a checkpoint, validated JSON backup/import and raw-cache recovery support reversibility. A failed validation or storage write leaves the previous journal intact.

An explicit account-copy adapter exposes only the existing repository read operation. It refuses pending account writes, preserves copied member scopes as read-only, removes linked live reminder IDs, and never copies experiment edits back. Source materials and arbitrary model/import data pass the existing validators.

The assistant adapter sees the sandbox snapshot and cannot persist changes. Reviewed complete proposals are applied by the same journal repository, against the captured revision. Chats use their own browser namespace. Existing same-account provider credentials can be read without modification; preview connection/disconnection uses a private sessionStorage slot and rechecks authentication before saving. Private consent uses an isolated popup with its opener severed before navigating externally. Shared helper defaults remain compatible with public callers.

## Alternatives and consequences
Applying a visual flag to live writers would make accidental account edits possible. Rebuilding a complete second product would again change identity and duplicate established features. A small original-style page with reused domain policies and concrete browser adapters provides a reversible trial. Some validated journal/assistant policies are reused from earlier experiment work; the rejected Studio UI is not restored.

Preview reminders are markers only. No real push, invites, profile updates, cloud writes, or automatic calendar authorization are performed. ICS/CSV/JSON/PDF downloads are real files. Local journal and chat storage are bounded; unsupported Web Locks or quota failures fail closed. Normal account offline queues, Firestore rules and worker configuration are untouched.

Experimental code is split into lazy `preview-*` chunks and excluded from public service-worker precaching. Returning to Administration leaves the experiment immediately. Reverting this PR removes the route without a data migration; retain JSON backups before clearing browser storage. Public rollout requires separate approval.

## Research used for design choices
- Preserve meaningful primary/secondary contrast rather than assuming universal emotional effects of hues: https://www.nngroup.com/articles/color-enhance-design/
- Keep frequent actions visible and disclose secondary tools: https://www.nngroup.com/articles/progressive-disclosure/
- Use motion for continuity, state and feedback: https://www.nngroup.com/articles/animation-usability/
- Respect system reduced-motion changes: https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html
