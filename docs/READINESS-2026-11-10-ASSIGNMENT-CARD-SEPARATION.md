# University assignments versus personal cards — 2026-11-10

Status: reviewed release authorized for commit/deployment on 2026-11-10. No production assignment/card writes or Push tests are permitted. Baseline HEAD: 7f21d73d379eee4bb751327f3a5bfd8834f21329.

## Proven cause

University tasks are persisted separately in users/{uid}/studyRecords/tasks_{id}. Native reminder linking deliberately creates a second backing record in users/{uid}/projects and stores its ID in task.reminderProjectId. shared/universityReminder.mjs gives it kind=deadline/resourceType=course. Browser syncReminder and Worker createTaskReminderService both use these backing records for the existing Push pipeline. Merely creating an ordinary task does not create a project: manual saveTask only updates an existing reminder link, and API task creation writes the study task. Opening/configuring a reminder or calling reminder-linking creates the backing record.

FirestoreWorkspaceRemote feeds personal project documents into Workspace/useTaskOverview without a distinction between reminder backing records and user-created cards. The Public API project-listing similarly enumerated the entire project collection. The bug is Wilo's classification/presentation of an internal backing entity as a personal card, not a duplicate university assignment, bad API key, or demonstrated malformed external-client request.

Read-only production evidence, restricted to the owner's resolved account, 2026-11-10: 6 non-deleted university task records, 4 reminderProjectId links, all 4 referencing persisted deadline/course project documents, zero missing linked projects, 50 total stored project documents. No additional unlinked project had an exactly matching task title (comparison used for diagnosis only; never for classification). No names, IDs, keys, content or prompts were printed or placed in fixtures. Requests/parameters sent by any particular external client were not observed; no Personal Hub repository, secrets or runtime was accessed.

## Fix and safety

A shared pure selector classifies only an exact persisted reminderProjectId plus native deadline/course type. Same title, URL or resource type alone cannot hide a personal card. The personal board/counts/weekly/section views and normal overview consumers use an account-isolated live task-link index; group cards are unaffected. Initial presentation waits for classification, and pending offline task links remain respected while the server catches up. Late callbacks cannot cross account boundaries.

NotificationSettings and CloudPushSync explicitly retain the full backing-record enumeration; schedules, preferences, Push subscription/device state, deadlines, course mappings, assignment records and helper records are not altered. Public API project listings exclude classified helpers before pagination; direct reminder operations keep using the same backing IDs. Reading projects does not require hydrating unrelated course payloads. OpenAPI/documentation explain this semantic correction with no endpoint/auth/schema changes. No migration or deletion is needed.

Historical records without a surviving task link cannot be proven internal by title; this change intentionally leaves them alone rather than deleting/hiding potentially legitimate cards. No conversion UI was found or invented: explicitly created personal copies have independent IDs and remain visible.

A pre-existing unnecessary regex escape in curriculum.ts was corrected to satisfy ESLint without changing regex semantics; curriculum tests and generated-domain check validate compatibility.

## Verification

- Final full application suite: 1,366 passed (146 files), including pending-offline links, account isolation, live/deleted/malformed record classification and same-title personal cards.
- Full Worker suite: 973 passed, including API task creation, retry/idempotency, course scoping, preserved reminder backing data and visible same-title/explicit personal cards.
- Chromium/Firebase emulator journeys: new manual-creation/separation cases on desktop and 390px phone; existing university/group reminder editor cases on both devices passed (4 journeys). Additional final course-view assertions verify both manual and existing assignments in their selected course.
- TypeScript/production-configured build, ESLint, architecture and generated API-domain/credential checks all passed. Initial parallel ESLint scan raced with transient Playwright trace removal; the sequential rerun after browser completion passed.
- Firestore rules are unchanged; browser tests exercise existing rules using synthetic accounts. The full rules/auth recovery suites were not rerun for this presentation fix. No live phone Push or physical device delivery was tested.

Read-only production diagnosis is evidence of the cause, not evidence that the fix is deployed. Review/publish Frontend and Worker together after authorization; no migrations, new services, credentials or IAM changes are required. No Personal Hub change is needed for the proven cause. Only if a client independently POSTs /projects for each assignment should that separate call be removed unless explicitly requested by the owner; this investigation found no evidence of that request.

## Authorized release verification

Fresh read-only baseline: 6 tasks, 4 linked backing documents, 50 total project documents. All 4 backing documents are already outside the current-card view (archived/trashed); the authenticated Home view shows 34 current cards, so Home should remain 34 after the release. The API should enumerate 46 genuine project records while preserving all 50 stored documents. Study/project snapshot digests are kept in ignored operator metadata for a read-only after-release comparison, never raw account contents in Git.

Added pagination regression: exclusion occurs before cursor/page selection so internal records cannot consume a visible-card page. No new scopes or changes to authentication, Firestore rules, D1 schema, IAM, subscriptions or scheduling are introduced. Production assets/Worker version and an existing authenticated Chrome session will be checked after deployment; an authenticated Public API body check requires an independently supplied existing API credential. No key is extracted from another application's state or manufactured through a privileged database write.
