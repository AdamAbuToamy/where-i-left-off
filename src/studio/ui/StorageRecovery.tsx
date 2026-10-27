import { Component } from "react";
import type { ReactNode } from "react";
import type { Language } from "../../translations";
import { downloadStudioFile } from "../adapters/download";
import { studioWord } from "./copy";
type Props = { storageKey: string; language: Language; children: ReactNode };
/** A broken preview can always be exited; recovery never touches public account storage. */
export default class StorageRecovery extends Component<
  Props,
  { failed: boolean; recoveryError: boolean }
> {
  state = { failed: false, recoveryError: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  private backup = () => {
    try {
      downloadStudioFile(
        "wilo-preview-recovery.json",
        localStorage.getItem(this.props.storageKey) || "{}",
        "application/json",
      );
    } catch {
      this.setState({ recoveryError: true });
    }
  };
  private reset = () => {
    const t = (key: Parameters<typeof studioWord>[1]) =>
      studioWord(this.props.language, key);
    if (!window.confirm(t("resetAsk"))) return;
    try {
      const raw = localStorage.getItem(this.props.storageKey);
      // Write the recovery copy first. If quota fails, keep the original untouched.
      if (raw) localStorage.setItem(this.props.storageKey + "/recovery", raw);
      localStorage.removeItem(this.props.storageKey);
      this.setState({ failed: false, recoveryError: false });
    } catch {
      this.setState({ recoveryError: true });
    }
  };
  render() {
    if (!this.state.failed) return this.props.children;
    const t = (key: Parameters<typeof studioWord>[1]) =>
      studioWord(this.props.language, key);
    return (
      <div
        className="wilo-studio st-load-recovery"
        dir={this.props.language === "en" ? "ltr" : "rtl"}
      >
        <section className="st-surface">
          <span className="st-eyebrow">WILO / {t("preview")}</span>
          <h1>{t("recovery")}</h1>
          <p role="alert">{t("failed")}</p>
          <p>{t("copyHint")}</p>
          <div className="st-dialog-actions">
            <button className="st-primary" onClick={this.backup}>
              {t("backup")}
            </button>
            <button className="st-secondary" onClick={this.reset}>
              {t("reset")}
            </button>
            <a href="#/admin">{t("exit")}</a>
          </div>
          {this.state.recoveryError && <p role="alert">{t("storageFull")}</p>}
        </section>
      </div>
    );
  }
}
