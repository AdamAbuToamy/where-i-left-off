import { armEntryAudio, cancelEntryAudio } from "../experience/entryAudio";
import {
  holdAuthEntry,
  finishAuthEntry,
  releaseAuthEntry,
  markGoogleRegistration,
  pendingGoogleRegistration,
} from "../lib/authEntry";
import "./authPrivacy.css";
import ChoicePicker from "./ChoicePicker";
import { registrationText } from "./registrationText";
import { registrationEligible } from "../lib/registrationEligibility";
import type { RegistrationAgeBand } from "../lib/registrationEligibility";
import { supportText } from "../supportText";
import { useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getAdditionalUserInfo,
  signOut,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { cloudText, errorText } from "../cloudTranslations";
import { pageText } from "../pageText";
import { traced } from "../lib/logging";
import type { Language } from "../translations";

export default function AuthPanel({ language }: { language: Language }) {
  const t = cloudText[language],
    eligibility = registrationText[language];
  const [ageBand, setAgeBand] = useState<RegistrationAgeBand>("");
  const [pendingGoogle, setPendingGoogle] = useState<User | null>(() =>
    pendingGoogleRegistration(auth?.currentUser || null),
  );
  const eligible = registrationEligible(ageBand);
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  async function perform(action: () => Promise<unknown>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await traced("auth.action", action);
    } catch (e) {
      cancelEntryAudio();
      setError(e);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (pendingGoogle) {
      if (eligible && auth?.currentUser?.uid === pendingGoogle.uid) {
        armEntryAudio();
        finishAuthEntry(pendingGoogle, true);
      }
      return;
    }
    if (register && (!name.trim() || !eligible)) return;
    if (actionLock.current) return;
    armEntryAudio();
    void perform(async () => {
      holdAuthEntry();
      try {
        if (register) {
          const result = await createUserWithEmailAndPassword(
            auth!,
            email.trim(),
            password,
          );
          await updateProfile(result.user, { displayName: name.trim() });
          window.dispatchEvent(new Event("profile-updated"));
        } else await signInWithEmailAndPassword(auth!, email.trim(), password);
        finishAuthEntry(auth!.currentUser, true);
      } catch (error) {
        releaseAuthEntry();
        throw error;
      }
    });
  }
  function google() {
    if (actionLock.current || (register && !eligible)) return;
    armEntryAudio();
    void perform(async () => {
      holdAuthEntry();
      try {
        const result = await signInWithPopup(auth!, new GoogleAuthProvider());
        if (
          (getAdditionalUserInfo(result)?.isNewUser ||
            pendingGoogleRegistration(result.user)) &&
          !eligible
        ) {
          markGoogleRegistration(result.user);
          setPendingGoogle(result.user);
        } else finishAuthEntry(result.user, true);
      } catch (error) {
        releaseAuthEntry();
        throw error;
      }
    });
  }
  const creating = register || !!pendingGoogle;

  return (
    <section className="auth-panel" aria-busy={busy}>
      <div className="auth-intro">
        <span aria-hidden="true">↗</span>
        <h2>{t.intro}</h2>
        <a href="/about.html">
          {
            {
              en: "About Where I Left Off",
              ar: "عن Where I Left Off",
              he: "על Where I Left Off",
            }[language]
          }
        </a>
      </div>
      <form onSubmit={submit} className="new-project-form auth-form">
        <h2>{creating ? t.signUp : t.signIn}</h2>
        <p className="legal-notice">
          {supportText[language].notice}{" "}
          <a
            href={`/terms.html?lang=${language}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {supportText[language].terms}
          </a>{" "}
          ·{" "}
          <a
            href={`/privacy.html?lang=${language}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {supportText[language].privacy}
          </a>
        </p>
        {creating && (
          <fieldset disabled={busy} className="auth-age-group">
            {pendingGoogle && <p>{eligibility.googleHint}</p>}
            <ChoicePicker
              label={eligibility.age}
              value={ageBand}
              options={[
                { value: "", label: eligibility.choose },
                { value: "under16", label: eligibility.younger },
                { value: "16plus", label: eligibility.eligible },
              ]}
              onChange={(value) => {
                if (value === "" || value === "under16" || value === "16plus")
                  setAgeBand(value);
              }}
            />
            <small>{eligibility.hint}</small>
            {ageBand === "under16" && (
              <p className="notice" role="status">
                {eligibility.blocked}
              </p>
            )}
          </fieldset>
        )}
        {register && !pendingGoogle && eligible && (
          <>
            <label htmlFor="name">{pageText[language].name}</label>
            <input
              id="name"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              dir="auto"
            />
          </>
        )}
        {!pendingGoogle && (!register || eligible) && (
          <>
            <label htmlFor="email">{t.email}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
            <label htmlFor="password">{t.password}</label>
            <input
              id="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 8 : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </>
        )}
        {error !== null && (
          <p className="notice error" role="alert">
            {errorText(error, language)}
          </p>
        )}
        {sent && (
          <p className="notice" role="status">
            {t.resetSent}
          </p>
        )}
        <button
          className="primary-button"
          disabled={
            busy ||
            (pendingGoogle
              ? !eligible
              : register && (!name.trim() || !eligible))
          }
        >
          {creating ? t.signUp : t.signIn}
        </button>
        {!pendingGoogle && (
          <button
            type="button"
            className="secondary-button"
            disabled={busy || (register && !eligible)}
            onClick={google}
          >
            {t.google}
          </button>
        )}
        <div className="form-actions">
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              if (pendingGoogle) {
                void perform(async () => {
                  cancelEntryAudio();
                  await signOut(auth!);
                  setPendingGoogle(null);
                  releaseAuthEntry();
                });
                return;
              }
              setRegister(!register);
              setError(null);
              setSent(false);
            }}
          >
            {pendingGoogle
              ? language === "ar"
                ? "إلغاء إنشاء الحساب"
                : language === "he"
                  ? "ביטול יצירת החשבון"
                  : "Cancel account setup"
              : register
                ? t.signIn
                : t.signUp}
          </button>
          {!register && !pendingGoogle && email.trim() && (
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await sendPasswordResetEmail(auth!, email.trim());
                  setSent(true);
                })
              }
            >
              {t.reset}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
