import { useEffect, useState } from "react";
import type { Language } from "../translations";
import { companionText } from "./text";
import {
  readCompanionState,
  saveCompanionPreferences,
  companionPreferenceEvent,
  companionStorageKey,
  refreshCompanionState,
} from "./preferences";
import type { CompanionCategory, CompanionPreferences } from "./policy";
import {
  readInstallPreference,
  saveInstallPreference,
} from "../lib/extensionInstall";
export default function CompanionSettings({
  uid,
  language,
}: {
  uid: string;
  language: Language;
}) {
  const [storageError, setStorageError] = useState(false);
  const [preferences, setPreferences] = useState(
      () => readCompanionState(uid).preferences,
    ),
    t = companionText[language];
  useEffect(() => {
    const update = () => setPreferences(readCompanionState(uid).preferences);
    const changed = (e: Event) => {
      if ((e as CustomEvent).detail?.uid === uid) update();
    };
    const storage = (e: StorageEvent) => {
      if (e.key === companionStorageKey(uid)) {
        refreshCompanionState(uid);
        update();
      }
    };
    window.addEventListener(companionPreferenceEvent, changed);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(companionPreferenceEvent, changed);
      window.removeEventListener("storage", storage);
    };
  }, [uid]);
  function change(next: CompanionPreferences) {
    setPreferences(next);
    setStorageError(!saveCompanionPreferences(uid, next));
  }
  return (
    <section className="settings-section companion-settings">
      <h3>{t.name}</h3>
      <p>{t.intro}</p>
      {storageError && <p role="alert">{t.storageError}</p>}
      <label>
        <input
          type="checkbox"
          checked={preferences.enabled}
          onChange={(e) =>
            change({ ...preferences, enabled: e.target.checked })
          }
        />
        {t.enabled}
      </label>
      <fieldset disabled={!preferences.enabled}>
        <legend>{t.name}</legend>
        {(
          ["deadlines", "stale", "features", "extension"] as CompanionCategory[]
        ).map((category) => (
          <label key={category}>
            <input
              type="checkbox"
              checked={preferences[category]}
              onChange={(e) => {
                if (category === "extension" && e.target.checked) {
                  saveInstallPreference({
                    ...readInstallPreference(),
                    dismissed: false,
                    snoozedUntil: 0,
                  });
                }
                change({ ...preferences, [category]: e.target.checked });
              }}
            />
            {t[category]}
          </label>
        ))}
        <label>
          {t.frequency}
          <select
            value={preferences.frequency}
            onChange={(e) =>
              change({
                ...preferences,
                frequency: e.target.value as CompanionPreferences["frequency"],
              })
            }
          >
            <option value="gentle">{t.gentle}</option>
            <option value="normal">{t.normal}</option>
          </select>
        </label>
      </fieldset>
    </section>
  );
}
