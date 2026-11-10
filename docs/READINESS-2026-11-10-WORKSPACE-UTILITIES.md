# Workspace utilities — 2026-11-10

Move PDF export and sync status to the outer left/end of the RTL command strip. PDF keeps its existing export action and gains a visible label; sync gets a bordered status chip with localized synced/syncing/offline/pending/local-copy labels derived from the existing real state. Detailed status remains accessible. Phone tools and existing hidden desktop sync chip behavior are preserved.

Verified with existing Chromium/Firebase emulator desktop/390px phone card journeys (2 passed) and desktop visual screenshot. No PDF-generation, persistence, authentication or sync protocol changes. No real user data writes, additional services or live notifications. Frontend-only publication follows the owner's request to publish UI changes for review.
