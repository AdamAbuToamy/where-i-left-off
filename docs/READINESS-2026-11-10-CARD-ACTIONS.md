# Card actions layout — 2026-11-10

Design change reviewed locally; production publication authorized by the owner after visual review. The New card action has stronger size/weight and a dedicated action row above desktop filters. Planning board stays adjacent as a quiet solid-border secondary action; the card count is separated at the opposite end. Phone retains its compact row and does not expose the desktop-only planning canvas.

Existing Chromium/Firebase-emulator section-view and card/university-separation journeys passed on desktop and phone (4 cases). A final phone-only rerun covers removal of the unnecessary mobile divider. TypeScript and ESLint passed; no business/auth/reminder/data logic changed. Visual inspection used synthetic screenshots at 1440px and 390px. No production data or physical phone was used. No new tests mirror the CSS implementation.
