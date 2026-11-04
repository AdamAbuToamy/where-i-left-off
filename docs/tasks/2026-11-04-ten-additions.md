# Ten independent administrator-preview tasks

All new UI/data features are restricted to the verified administrator. Preserve normal users, account isolation, existing planners and revision checks. No production-account test data writes.

| Task | Acceptance | Status |
|---|---|---|
| 1 Inbox | Instant text/link capture, persistent queue, explicit conversion to a real card, duplicate-safe retry | Passed focused tests; final regression pending |
| 2 Resume | User-selected daily top three, last session/context, direct start session, waiting items | Pending |
| 3 Relations | Related/part/dependency, reject cycles, card visibility and board connection semantics | Pending |
| 4 Time planning | Date/time/duration separate from due date, drag scheduling, lesson/block conflict review | Pending |
| 5 Follow-up/review | Explicit follow-up date, stale/waiting review, snooze/archive/continue without automatic deadline edits | Pending |
| 6 University | Course checkpoint/next step, exam plan, assignment effort/time remaining, grouped resources, optional weighted grades | Pending |
| 7 Assistant | Actual selected card/course context, preserve pending proposal in follow-up, explicit supported/handoff limits and per-task results | Pending |
| 8 History | Confirmed version history with actor/source, explicit revision-checked restoration; no unsupported permanent-delete undo | Pending |
| 9 Templates/repeat | Built-in and reusable templates, explicit recurrence generation, calendar-correct monthly dates, no duplicate occurrences | Pending |
| 10 Board | Named multiple boards, undo/redo retained, PNG/PDF export, explicit sticky-note-to-card conversion | Pending |

Each task receives focused domain/application/browser evidence and separate implementation modules; shared integration is verified together. final report/checklist records actual tests and limitations. Required knowledge file docs/knowledge/university/university_rules.md is absent.

Task 1 evidence: 2 capture tests, 6 preserved journal tests, personal export test, 2 emulator browser journeys (capture/convert/account restore + ordinary-account exclusion), 2 new security tests passed. No live-account writes.
