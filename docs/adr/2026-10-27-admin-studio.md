# Admin Studio isolation — 2026-10-27

## Context
The approved redesign must be usable by the verified administrator without changing the normal account interface or data. The existing Firebase persistence, offline queues and model validators already enforce important invariants.

## Decision
Implement a lazy-loaded administration route, `#/admin/studio`, with scoped CSS and private browser persistence. The composition root wires a journal repository to a Web Locks/localStorage adapter. Pure commands use existing task planners, project entities and university validators. Model inference returns a complete validated proposal; the repository applies all changes atomically against the expected journal revision.

The initial dataset is demonstrative. An explicit read-only adapter can copy the current account into the experiment; no production writer is exposed. Account copies with pending saves are refused. Copied member scopes remain read-only. Actual authentication identity and verified administrator status are checked at persistence boundaries. Browser namespaces include project and UID.

Undo/redo retains twenty snapshots; a separate checkpoint and JSON backup/import provide recovery. Malformed caches expose export/reset controls and retain a recovery copy before reset. Failed storage writes preserve the previous journal. Cross-tab updates require Web Locks and compare revisions.

The preview may reuse the existing provider credential read-only. Connecting or disconnecting the preview uses its own sessionStorage credential slot, preserving the public assistant connection. Chats are private browser data, not synchronized account records. Diagnostic timing data never includes credentials or prompts.

## Alternatives
A public feature flag over existing live writers risks accidental production changes. A separate duplicated application would diverge from domain rules. Reusing validators with a narrow sandbox persistence port provides a concrete trial with lower data risk.

## Consequences
The experiment is local to this browser/device. Group work, reminders and profile settings are simulations of those private records, not new cloud services. No database schema or rules changes are necessary. Calendar export is a real ICS download; automatic calendar sync is deferred because it requires a registered OAuth integration and explicit external write consent. See [Google import](https://support.google.com/calendar/answer/37118) and [Calendar authorization](https://developers.google.com/workspace/calendar/api/auth).

The private route and chunks are lazy-loaded, and experimental bundles are excluded from public service-worker precaching. Shared assistant helpers gain optional injected credential collaborators with their existing defaults preserved. This narrowly affects an existing boundary rather than rewriting it.

## Recovery and rollout
Returning to `#/admin` immediately leaves the experiment. Studio settings offer undo/redo, checkpoint restore, JSON export/import and reset. Nothing is copied back into account data. Roll back the release by reverting the Studio commit/PR and deploying through the existing quality gate. Preserve downloaded backups before clearing browser site data. Public rollout requires separate user authorization.
