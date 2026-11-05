# Assistant catalog latency — 2026-11-05

The user observed 39 seconds for a timetable question. This is user-provided end-to-end evidence, not a measured provider timing breakdown. Inspection found serial routing, workspace generation, and optional model-requested reads. Initial catalogs omitted timetable times and rooms, forcing a read round even for basic timetable answers.

Expanded bounded catalogs with day/start/end/room/sessionType, deadline dates, kind and status. Empty supplemental strings are omitted. Existing 6,000-character/25-record limits and hasMore remain; imported sources and notes are excluded. Model instructions prefer answering from available facts and still require reads for absent facts/pages. This applies to general timetable/deadline/state questions without matching specific user phrases. No save path, permission or provider selection changed.

Verification: backend 896 passed; client 25 passed; architecture passed; TypeScript production build and credential check passed. New injected-provider regression supplies all timetable facts in the first workspace inference and confirms a one-invocation answer path; it does not prove a live model will always choose it. Pagination and private-note omission are tested. Existing bundle-size warning remains.

Published worker: ec58e07f-f1a3-4aba-895a-9995704bfb1e. Hosting release: wilo-assistant-catalog-speed-20261105. No live authenticated inference/latency measurement performed. Provider queuing, routing latency, and reading the account can still contribute. No claimed seconds-level guarantee.
