# Expanded card dock — 2026-11-06

Requested: open enlarged cards like the assistant, move the workspace aside, simplify displayed details, and provide a pleasing opening animation.

Implementation: desktop card details and editing move to a left-side dock using a body portal; workspace reserves layout space. Tablet uses the full width and phone remains a full-screen surface. Existing card sorting stays in ProjectBoard; an open-card placeholder preserves its place. Background is inert while the detail dialog is open to avoid simultaneous card panels. Assistant visibility is suspended until the card closes, preserving its state.

Details are divided into Overview, Checklist, Notes, and Links/dates. Only the selected sections are visible; status/progress and work-session actions are in Overview. Edit/archive/delete remain in existing card options, with existing revisions/permissions/save handlers. No schema/backend/provider changes. Desktop reveal combines a short translation/scale and aperture reveal; phone uses a short aperture/fade without keyboard geometry transitions. Page changes animate briefly; reduced-motion preferences disable them.

Verification: four compact-card/permission unit tests passed; three emulator browser journeys cover desktop and phone detail pages, hidden notes, links, editing/save/close, and existing mobile add/keyboard viewport/bottom-nav journey. Desktop Escape/focus restoration and reduced motion additionally checked. Screenshots inspected at `.wrangler/card-detail-desktop.png` and `.wrangler/card-detail-phone.png`. Architecture and production build/lint results recorded separately. Physical devices and actual frame-rate measurement are not performed. No claim of physical-device smoothness. University knowledge rules file remains absent.

Final checks: three browser journeys passed (15.3 seconds), including reduced motion and Escape/focus restoration. Lint zero errors with the existing AssistantWidget cleanup-ref warning. Architecture passed. Production TypeScript/Vite build and credential pattern check passed with existing large-chunk warning.
