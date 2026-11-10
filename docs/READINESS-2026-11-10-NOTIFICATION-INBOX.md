# Notification inbox compatibility — 2026-11-10

The immediate task Push handler emits `#/university?courseId=<courseId>`. The browser feed validator previously rejected this route, rejecting the whole feed when such a notification existed. Added the bounded university course route to its existing safe-navigation allowlist. No broad external URL acceptance.

Empty inbox UI no longer appears alongside a failed refresh. Existing records, delivery schedules, preferences and Push subscriptions are unchanged.

Focused tests: 3 passed, covering real emitted route, unsafe/oversized query rejection, refresh failure and successful retry rendering. This reproduces a concrete code mismatch; the affected user's authenticated production feed was not inspected. No live Push sent or user records modified. Production asset proof stored outside Git in /home/adam/wilo-recovery/20261110-notification-inbox after release.
