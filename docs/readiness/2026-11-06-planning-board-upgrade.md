# Planning board upgrade — 2026-11-06

## Delivered capabilities

- Native board thread meaning (related / part of / depends on), explicit source/target, direction reversal and optional 240-character explanation; selecting a thread exposes its editor. Rope texture and hover title underline remain.
- Dependency blockers derive from current card status and open the blocking card. Finished sources do not show blockers, and no card status is automatically changed. Circular dependency proposals fail validation with a localized explanation.
- Named visual areas can be resized and moved freely. Moving an area moves papers whose origins are inside it; resizing changes the frame only. Removing an area preserves its papers. All operations share board undo/revision handling.
- Card nodes display title, next step/fallback and state. Existing card detail/edit/work-session UI opens while the native board dialog is suspended, then the same mounted board resumes with its viewport retained. Missing records do not trigger foreign lookups.
- Focus mode emphasizes a selected item and its direct neighbors. Notes remain independent until explicit conversion.
- Explicit note conversion creates a card via the existing offline workspace and validation path, with a deterministic account/scope/note hash and matching-content guard for retries. Position and threads are retained. A note over the card description limit must be shortened explicitly; it is never silently truncated.
- Per-account, per-scope, per-device viewport/selection cache, fit-all including freehand circles, zoom controls and locate-selection. View movements do not pollute document undo history.
- Existing board undo/redo now covers thread meaning/labels, areas, movements, notes, circles and board conversion references. Undo/removing board references never deletes source cards, including cards created by conversion; this is stated in Help.

## Integrity and compatibility

Domain parser continues to reject unknown fields, duplicate/dangling references, self links, invalid geometry and oversized content. New zone items and optional thread metadata are additive within the existing bounded v1 payload. Old boards load without rewriting their data. Existing revision transactions, account isolation, offline queues and 150,000-character payload limits remain. No Firestore rules, schema envelope, provider, login, backend or dependency versions changed.

Legacy relationship records stay in their existing admin-only store. The board reads those meanings for compatibility; subsequent semantic edits materialize them into the board journal rather than making two non-atomic writes. A normal-account browser journey exposed that the old provider attempted to start an admin-only repository for everyone; it now mounts only for its authorized matching admin. No permission was broadened. Unknown legacy meanings are not overwritten before they load.

Conversion spans a project outbox and a private board journal, not a cross-document transaction. Project creation is accepted first; failure to update the board leaves the note for an idempotent retry. A changed/deleted prior conversion is never overwritten by a retry. Undo of the board does not erase a created project. Group note conversion remains gated by existing create permission and assignment rules.

Viewport cache is local to the current device/account/scope; document layout, areas and relationships sync through the account. History remains the existing bounded session history. Older already-open application clients must refresh before reading enriched boards; safe UI rollback must retain the extended codec rather than deploying an older parser over new zone payloads. JSON export remains available. No automatic deletion or migration of legacy data occurs.

## Verification evidence

- `npm test`: 1297 passed (128 files).
- Focused domain/application: 27 passed, covering cycles/direction, blockers, zones, conversion/reference preservation, undo, idempotent guarded creation, legacy eligibility and viewport account isolation.
- `npm run test:rules` with Java 21/Firestore emulator: 690 passed (17 files), including enriched payload owner isolation.
- `npm run test:auth:recovery`: 4 passed.
- `node --test push-worker/*.test.mjs`: 896 passed; backend unchanged.
- Five browser journeys passed in 57.2 seconds on isolated port 5195: old desktop ropes/notes/circles/order and cross-context restore, phone exclusion/lazy loading, offline/reload/removal safety, legacy semantics, and a normal-account integrated upgrade journey including live resizing and return from card details.
- Screenshots inspected: `.wrangler/planning-upgraded.png`, prior desktop/phone board evidence. Tests use real application code against injected Firebase emulators, not production account writes.
- Architecture check passed (29 modules). Lint: no errors, one existing AssistantWidget cleanup-ref warning. Production TypeScript/build and credential checks performed before publication; existing large-chunk warning remains.
- Referenced `docs/knowledge/university/university_rules.md` is missing, verified; no claim of reading it.

## Limits

No physical-device/frame-rate profiling or store distribution checks were performed. Board remains desktop-only. No live model check is relevant to these manual board operations. Production verification is read-only asset/version comparison, not a live authenticated board mutation. Additive payloads require retaining codec support during rollback.
