# Card visual refinement — 2026-11-06

User requested removal of the generic yellow status badge and improvement of similar template-like details. Scope deliberately preserves the existing palette, card silhouette, typography system, features and animation.

Changes: status uses readable text plus a restrained side rule instead of a yellow rounded badge and dot. State labels remain explicit; color is supplementary. Card metadata uses plain captions with a separator rather than stacked pills. Secondary/destructive card actions lose raised colored shadows and use theme-aligned surfaces. Resource links use a simple divider instead of a nested colored box, and card-options text is quieter. Phone-specific tiny status sizing was removed to share the readable 12px annotation.

Verification: two emulator browser journeys passed (32.1s), desktop and phone, including transparent status/no decorative dot, detail-page visibility, editing/save, bounds, close, and desktop Escape/focus and reduced motion. Inspected desktop and phone screenshots. Production build/TypeScript, credential pattern check and lint were run; existing large-bundle and AssistantWidget cleanup-ref warnings remain. No persistence/backend/security behavior changes, no physical-device check.
