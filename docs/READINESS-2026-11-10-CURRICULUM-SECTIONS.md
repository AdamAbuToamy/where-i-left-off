# Curriculum import and grouped cards readiness — 2026-11-10

## Reviewed scope

Map-only curriculum import (XLSX/DOCX/text PDF), bounded local extraction, validated full-plan review, academic year/semester/code/order/prerequisites, semester focus, editable placement, revisioned per-account persistence and backup restore. Independent card view grouped by section with translucent backgrounds, subtle focus scaling/blur, mobile controls and reduced-motion support. No active-course creation, additional service, provider inference, scheduler, credentials or user data migration.

## Verified locally

- Application suite: 1,359 tests, 144 files.
- Worker suite: 970 tests including curriculum isolation from existing active-course hydration.
- Firestore emulator/Java21: 694 tests, 18 files; new curriculum owner/cross-account and revision restrictions retain existing owner envelope.
- Chromium university journeys: desktop and 390px phone; real synthetic XLSX/DOCX/PDF parsing, three-course review, term focus, move/edit, persistence on reload, unchanged zero active-course count, no horizontal page overflow.
- Chromium grouped-card journeys: desktop and 390px phone; section membership/no-section grouping, hidden section selector, return to ordinary Cards, hover blur, no horizontal page overflow. The phone test found previously hidden view tabs in the tools dialog; the scoped override now exposes them.
- Authentication recovery emulator: 4 tests; final combined Chromium run: 4 journeys passed.
- TypeScript, ESLint, architecture boundary check and generated API domain check passed. Production dependency audit: zero advisories; full development tree retains existing 23 moderate entries.

## Compatibility and limits

Plans use one existing revisioned studyRecords record each, so import does not partially activate courses. Individual plans use the same per-user offline journal and Firestore transaction protections. Updating received data while a review is open is rejected by updatedAt comparison; subsequent transactional races use repository revision conflicts. Existing active course API hydration explicitly ignores curriculum records. Rules allow the additional kind with the same owner/revision/payload constraints; no permission broadening to other accounts.

Analysis is deterministic, not universal AI understanding: headings and structured tables are recognized; ambiguous/missing terms require correction. Scanned PDFs need OCR; legacy DOC/XLS require conversion. Max 8 MB file, 100 PDF pages, 12,000 rows, 500,000 extracted characters, 1,000 courses/plan and 600,000 UTF-8 bytes persisted per record. Archive metadata guard rejects declared expansion over 40 MB; this is a defensive limit, not a sandbox guarantee against maliciously inconsistent ZIP data. Third-party parsers are lazy imported.

No physical Android/iPhone, real curriculum document or real Google OAuth round trip was tested. All mutable validation used synthetic emulator accounts/documents. No production user records, reminders or Push messages are created by verification. Curriculum is not exposed as a new Public API area in this release. Existing Chrome import code is unchanged.

Deployment verification is separate: publish reviewed Worker (so active-course APIs tolerate map records), non-destructive rules update, and Hosting using preserved public Firebase/App Check configuration; verify read-only health, protected API denial, published assets and release hashes. Release IDs and final production evidence are recorded in the recovery release log after deployment.

Repository knowledge instructions reference docs/knowledge/university/university_rules.md, which is absent; no claim was made to have read that missing file. AGENTS.md, PROJECT_ENGINEERING_GUIDELINES.md and SECURITY.md were read.
