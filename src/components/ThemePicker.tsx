import { colorModes, readColorMode, saveColorMode } from "../lib/colorMode";
import { useEffect, useState } from "react";
import type { Language } from "../translations";
import { settingsText } from "../settingsText";
import { backgroundText } from "../backgroundText";
import {
  backgrounds,
  readBackground,
  readTheme,
  saveBackground,
  saveTheme,
  themes,
} from "../lib/theme";

export default function ThemePicker({
  uid,
  language,
}: {
  uid: string;
  language: Language;
}) {
  const [mode, setMode] = useState(() => readColorMode(uid));
  const modeText = {
    ar: ["إضاءة الموقع", "حسب الجهاز", "فاتح", "داكن"],
    en: ["Color mode", "System", "Light", "Dark"],
    he: ["מצב תצוגה", "לפי המכשיר", "בהיר", "כהה"],
  }[language];
  const [theme, setTheme] = useState(() => readTheme(uid));
  const [background, setBackground] = useState(() => readBackground(uid));
  const t = settingsText[language],
    b = backgroundText[language];
  useEffect(() => {
    const changed = () => {
      setMode(readColorMode(uid));
      setTheme(readTheme(uid));
      setBackground(readBackground(uid));
    };
    window.addEventListener("appearance-changed", changed);
    return () => window.removeEventListener("appearance-changed", changed);
  }, [uid]);
  return (
    <section className="settings-section">
      <h3>{t.appearance}</h3>
      <p>{t.appearanceHint}</p>
      <h4 className="color-mode-heading">{modeText[0]}</h4>
      <div className="color-mode-options" role="group" aria-label={modeText[0]}>
        {colorModes.map((value, i) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              saveColorMode(uid, value);
            }}
          >
            {modeText[i + 1]}
          </button>
        ))}
      </div>
      <div className="theme-options" role="group" aria-label={t.appearance}>
        {themes.map((value, i) => (
          <button
            type="button"
            key={value}
            className={`theme-option theme-preview-${value}`}
            aria-pressed={theme === value}
            onClick={() => {
              setTheme(value);
              saveTheme(uid, value);
            }}
          >
            <span className="theme-swatch" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{t.themes[i]}</span>
            <span aria-hidden="true">{theme === value ? "✓" : ""}</span>
          </button>
        ))}
      </div>
      <div className="background-settings">
        <h3>{b.title}</h3>
        <p>{b.hint}</p>
        <div className="background-options" role="group" aria-label={b.title}>
          {backgrounds.map((value) => (
            <button
              type="button"
              key={value}
              className="background-option"
              aria-pressed={background === value}
              onClick={() => {
                setBackground(value);
                saveBackground(uid, value);
              }}
            >
              <span
                className={`background-preview background-preview-${value}`}
                aria-hidden="true"
              />
              <span className="background-option-label">
                {b.labels[value]}
                <span aria-hidden="true">
                  {background === value ? "✓" : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
