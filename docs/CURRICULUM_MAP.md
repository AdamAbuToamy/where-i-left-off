# Curriculum maps (2026-11-10)

Open University → Course map → Import study plan. Select XLSX, DOCX, or a text-based PDF (8 MB; PDF ≤100 pages). Files are read locally; there is no external inference request or server file upload. Legacy XLS/DOC must be converted first; scanned/image-only PDFs require OCR outside Wilo.

Analysis recognizes English, Arabic and Hebrew course-code/name/year/semester table headings, year/semester headings and numbered course lines. It preserves document ordering and explicit prerequisites. It is a bounded deterministic document analyzer, not a claim of universal AI/OCR understanding: missing/ambiguous placement is shown for review, never invented. Review the course count against the original document before saving. Unrecognized layouts may require adjustment or conversion to a structured table.

Review the extracted plan, edit any course and apply its changes, then save the complete plan. Every course requires a unique number, name, year and semester; prerequisite references must exist and cannot form cycles. Semester 3 denotes summer. Selection of a year/semester dims/blurs other lanes; show all restores the full map. Edit/Move changes placement and within-term order. Directed prerequisite connections are shown only when documented or explicitly edited.

## Persistence and compatibility

Plans are `curricula_<planId>` records in the existing user-owned `studyRecords` collection. Each plan is a separate, bounded JSON payload using the existing revisioned repository, transactional Firestore writes, account-specific offline outbox and explicit conflict resolution. Import saves the whole validated plan in one record. Plans never create active `courses`, tasks, lessons or reminders. No new scheduler/database/service is introduced. The existing active-course map remains available.

The UI checks the plan's update timestamp before applying a review over a newer received plan; repository revisions handle races during transactional writes. Cloud authorization remains verified-owner-only, with suspension/deletion gates and monotonic revisions unchanged. Old application clients do not understand the new record kind; deploy the updated app/rules/Worker together. Public course/task API hydration explicitly excludes map-only curriculum records without converting them or failing active-course requests. Public API does not expose curriculum management in this release. The generated API domain bundle is refreshed from the same source validators.

Existing university backup exports include the plans; validated restore merges plans by stable ID without activating their courses or overwriting existing plans. Chrome import remains focused on active courses.

## Section-grouped cards

Cards → By sections (next to Week) shows translucent named section groups and No section for unassigned/orphan cards. The individual section selector is hidden; search, status and assignment filters still apply. Existing section choice is restored on returning to Cards. Hover with a fine pointer gently scales the focused group and blurs siblings; keyboard focus also provides focus. Touch needs no hover. Reduced-motion and Wilo's disabled-motion setting suppress scaling transitions. Grouping never changes card ownership or section membership.
