# Tour overview visibility and automatic target reveal — 2026-11-10

University and Groups introduction steps now focus the whole page container, leaving its contents clear and applying blur only outside the overview. Button/field instructions still use narrow focus.

New targets are revealed through the native scrollIntoView boundary before guide geometry is measured. The helper checks viewport/visual viewport bounds and clipping scroll ancestors, centers normal controls and shows the beginning of oversized overview sections. It runs on target changes rather than fighting manual scrolling. Ancestor reveal-animation completion may retry positioning, and focusout updates the guide when leaving the title field for Save. Existing card/form submission and user data remain unchanged.

Validation: full application suite 151 files / 1378 passed; focused scroll/accessibility suite 9 passed; desktop English and phone Arabic browser journeys passed. Browser assertions check Save is inside the viewport without Playwright clicking/scrolling it first, and verify the University container/ancestors/contents have no guide blur. Phone University screenshot reviewed. Final lint, architecture, TypeScript/production build and credential checks are release gates.

Physical handset keyboard behavior is not certified by viewport emulation. No backend, scheduler, auth, data schema, reminder or API changes. No production user writes or Push tests.
Recovery/production proof: /home/adam/wilo-recovery/20261110-tour-reveal/.
