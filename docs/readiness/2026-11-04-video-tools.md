# Video tools, admin interaction study and search delivery — 2026-11-04

## Scope and evidence

Reviewed all four supplied videos using local frame extraction and full local audio transcription, and read the pasted Google Search troubleshooting text. Media was not uploaded to a provider. Analysis artifacts remain ignored in `.wrangler`.

- 00.18.54: The Kitchen by dqnamo; tactile buttons, Ticket, cassette player, receipt printer, deliberate confirmation.
- 00.04.19: Karpathy Skills, Ponytail, Matt Pocock Skills, Addy Osmani Agent Skills, ECC and Superpowers.
- 00.04.23: Desloppify scan/fix/rescan workflow.
- 00.13.22: Google ownership verification, sitemap submission and URL inspection. It does not establish that changing browsers fixes Google's quota.

User explicitly selected admin account first for the design. Existing signed-in public design remains mandatory and unchanged for regular users. Existing authentication, provider, worker, database rules and persisted schemas are unchanged.

## Implementation

### Design

`DesignPreviewProvider` adds `data-kitchen-study` only for the existing verified administrator predicate and removes it on cleanup/account changes. No new admin role, permission or legacy theme switch was added. This is an account-scoped UI study, not an access-control mechanism.

Original CSS uses the Kitchen Ticket and Tactile Button studies as design references: paper surface, perforation-style separator, inset footer action, raised button face, restrained unfolding motion and richer card shadows. The original card children remain mounted, and the sorting handle remains owned by the existing board. Native keyboard actions, Escape, mobile controls and reduced motion remain supported. No third-party component source was copied: the pages did not expose a clear source license during review. No new runtime dependency was installed. This is not a complete replacement of every screen with Kitchen components.

### Search delivery

Live read-only checks before deployment returned XML for `/sitemap.xml`, text for `/sitemap.txt` and `/robots.txt`, and HTML for the two actual public pages. This confirms the sitemap was not falling through to the SPA in the observed requests. Existing Google verification file and canonical URLs are preserved.

Added explicit UTF-8 Content-Type and revalidation headers for the sitemap and robots files. Robots advertises one primary XML sitemap; the existing text sitemap remains available and consistent for old submissions. XML is readable and contains only the two canonical public URLs. No private hash routes, fake lastmod dates or indexing API workaround was added.

`npm run check:seo`, also called by prebuild, validates canonical destinations, XML/text agreement, robots access and Hosting type declarations. This is a static repository delivery check, not a Google indexing test or a general XML parser.

The supplied earlier Search Console live test succeeded and homepage was indexed. Google report ingestion and indexing quota cannot be corrected by changing a valid sitemap's formatting alone. Browser control initialization failed in this session, so Search Console was not resubmitted or inspected directly. **The outstanding Google report status is NOT VERIFIED RESOLVED.** After deployment, submit the existing `/sitemap.xml` once in Sitemaps if needed; do not request indexing of the XML as if it were a content page. A later successful processed status is required to close that external issue.

### Code quality

Installed Desloppify 1.0 in ignored `.wrangler/desloppify-venv`, separate from the app lockfile/dependencies. Ran the same TypeScript CI mechanical scan before and after.

- Before: objective 90.0/100; 273 detector findings.
- After initial cleanup: objective 90.1/100; 275 detector findings; two auto-resolved and four new as code layout/coverage changed.
- Strict 22.5 reflects 20 unassessed subjective dimensions; no subjective assessment was performed. This is not a claimed 90% comprehensive security/readiness certification.
- Slow duplicate detection was skipped by the CI profile. Backend was not scanned in this TypeScript pass.

Reviewed reported credential/parser/cycle findings. Examples of false positives include translated Password label, emulator-only placeholder token, public Firebase configuration and type-only import cycles. Did not remove validation or rename these solely to improve a score.

Made compressed course matching, stream parsing and session journal code readable with the existing available formatter, without intentional behavior changes. Fixed malformed/null/primitive university cache reads to give the existing actionable recovery error, preserving original cached bytes. Invalid sync JSON follows the same failure path; it is never reset to an empty plan. Added a regression test covering those cases.

Remaining structural complexity, broader coverage and false-positive triage are recorded, not represented as fully eliminated. No broad automated refactor or autofix was run.

### Installation handoff

See `docs/guides/2026-11-04-video-tools-ar.md`: exact six source repositories, Codex app and CLI options, separate Windows/WSL skill environments, selected-skill installation, updates, and Desloppify commands. None of the six global skill packs were silently installed; the user requested instructions. Existing AGENTS.md was preserved. `docs/knowledge/university/university_rules.md` is absent, so it was not read or invented.

## Validation

- Unit/application: 1,265 passed across 118 files, including new cache regression.
- TypeScript: `npx tsc -b` passed.
- Lint: zero errors; one pre-existing AssistantWidget ref-cleanup warning remains.
- Architecture: 22 checked modules, zero violations.
- Initial browser verification: 5 passed (existing design preview desktop/phone, new admin desktop/phone, regular account isolation). A duplicate fixture card name caused an earlier test-only strict locator failure and was corrected with separate names.
- Final mobile-spacing browser verification and production proof: see production JSON alongside this report.
- Credential source/dist scans and reachable Git history pattern scan passed; these are bounded pattern checks, not proof that every possible secret format is absent.
- Production build passed; existing large-chunk warning remains.
- Rules, backend, auth-recovery suites, live model, physical phone/microphone and store tests were not rerun for these frontend/Hosting-only changes. No server/rules changes were made.

## References

- https://www.dqnamo.com/kitchen
- https://www.dqnamo.com/experiments/ticket
- https://www.dqnamo.com/experiments/tactile-button
- https://github.com/peteromallet/desloppify
- https://support.google.com/webmasters/answer/7451001
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://learn.chatgpt.com/docs/build-skills

## Rollback

Hosting rollback to `wilo-privacy-eligibility-20261103` restores the previous frontend without data migration. No worker rollback, key rotation or account changes are needed. Admin design can also be removed by reverting the provider import/attribute and its isolated CSS; regular public account styling has not been replaced.

## Decision

READY for admin-only design review after final browser/Hosting verification. NOT READY to declare the external Search Console ingestion issue resolved without an updated successful Google result. This report does not certify every historical detector finding as fixed.
