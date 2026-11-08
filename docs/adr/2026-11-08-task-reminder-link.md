# Native assignment reminder link and consolidation

Use a single ensure-link operation on an existing task, not a generic reminder-card creation API. Read/write scopes are independent and task/course/card resources are restricted to the bearer owner. Existing native reminder projection and domain validators are shared with the browser; delivery remains in the existing Worker scheduler.

Firestore and D1 cannot share a transaction. A small additive D1 recovery-hint table and private Firestore outbox bridge the existing stores: hint first, atomic paused card/task/receipt, create-only D1 settings, revision-guarded publication, native scope wake, read-back. The existing cron performs bounded reconciliation. Retrying never creates another link or overwrites settings. Manual/pref/revision changes block recovery instead of guessing a merge. Status verification and successful delivery are separate facts.

Alternatives rejected: a client-managed card plus separate reminder writes would bypass assignment invariants; optimistic retries after ambiguous commits would duplicate work; a second scheduler/service would diverge from Wilo. Existing backend data-writer IAM already covers the same private collections; no permission broadening is required. Consolidation uses verified ancestry/fast-forward and keeps the former development directory as recovery.
