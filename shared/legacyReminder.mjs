/** Classify existing native settings without migrating or copying a schedule. */
export function isExplicitLegacyReminder(card) {
  return !!(
    card.schedule ||
    card.remindAt ||
    card.weekly ||
    card.time ||
    (card.leadMinutes !== undefined && card.leadMinutes !== null) ||
    card.apiReminderIntent
  );
}
export function legacyReminderSource(card) {
  return isExplicitLegacyReminder(card) ? "legacy-explicit" : "account-default";
}
export function legacyDefaultSuppressed(card, hasIndependent) {
  return !!hasIndependent && !isExplicitLegacyReminder(card);
}
