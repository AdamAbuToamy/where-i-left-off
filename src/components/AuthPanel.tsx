import { armEntryAudio, cancelEntryAudio } from "../experience/entryAudio";
import {
  holdAuthEntry,
  finishAuthEntry,
  releaseAuthEntry,
  markGoogleRegistration,
  pendingGoogleRegistration,
} from "../lib/authEntry";
import "./authPrivacy.css";
import "./authJourney.css";
import { authJourneyText } from "./authJourneyText";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import ChoicePicker from "./ChoicePicker";
import { registrationText } from "./registrationText";
import { registrationEligible } from "../lib/registrationEligibility";
import type { RegistrationAgeBand } from "../lib/registrationEligibility";
import { useEffect, useRef, useState } from "react";
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
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<"email" | "password" | "profile">("email");
  const [visiblePassword, setVisiblePassword] = useState(false);
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
    if (actionLock.current) return;
    if (step === "email") {
      setError(null);
      setSent(false);
      setStep("password");
      return;
    }
    if (register && step === "password") {
      setError(null);
      setStep("profile");
      return;
    }
    if (!email.trim() || !password) {
      setStep("email");
      return;
    }
    if (register && (!name.trim() || !eligible || password.length < 8)) return;
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
    if (actionLock.current) return;
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
  const words = authJourneyText[language];
  const currentStep = pendingGoogle ? "profile" : step;
  const stepIndex =
    currentStep === "email" ? 0 : currentStep === "password" ? 1 : 2;
  const stepCount = creating ? 3 : 2;
  useEffect(() => {
    if (currentStep !== "email")
      heading.current?.focus({ preventScroll: true });
  }, [currentStep]);
  function changeMode() {
    setRegister(!register);
    setStep("email");
    setPassword("");
    setName("");
    setAgeBand("");
    setVisiblePassword(false);
    setError(null);
    setSent(false);
  }
  function back() {
    if (busy) return;
    setError(null);
    setSent(false);
    setVisiblePassword(false);
    if (step === "profile") setStep("password");
    else {
      setStep("email");
      setPassword("");
    }
  }

  return (
    <section
      className="auth-panel auth-journey"
      aria-busy={busy}
      dir={language === "en" ? "ltr" : "rtl"}
    >
      <div className="auth-journey-welcome">
        <span className="auth-journey-eyebrow" dir="ltr">
          WILO
        </span>
        <h1>
          {words.welcome}
          <span dir="ltr">Where I Left Off</span>
        </h1>
      </div>
      <form onSubmit={submit} className="auth-form auth-journey-form">
        <div className="auth-journey-progress" aria-hidden="true">
          {Array.from({ length: stepCount }, (_, index) => (
            <span
              key={index}
              className={index <= stepIndex ? "is-complete" : ""}
            />
          ))}
        </div>
        <div className="auth-journey-step-heading">
          {currentStep !== "email" && !pendingGoogle && (
            <button
              type="button"
              className="auth-back"
              onClick={back}
              disabled={busy}
              aria-label={words.back}
            >
              {language === "en" ? (
                <ArrowLeft size={19} />
              ) : (
                <ArrowRight size={19} />
              )}
            </button>
          )}
          <span
            role="status"
            className="auth-step-count"
            dir={pendingGoogle ? undefined : "ltr"}
          >
            {pendingGoogle ? words.finish : `${stepIndex + 1} / ${stepCount}`}
          </span>
        </div>
        <h2 ref={heading} tabIndex={-1}>
          {pendingGoogle
            ? words.profile
            : currentStep === "email"
              ? register
                ? words.newAccount
                : words.emailTitle
              : currentStep === "password"
                ? words.passwordTitle
                : words.profile}
        </h2>
        {currentStep !== "email" && !pendingGoogle && (
          <p className="auth-email-summary">
            <bdi>{email}</bdi>
            <button
              type="button"
              className="auth-inline-action"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setPassword("");
                setError(null);
              }}
            >
              {words.change}
            </button>
          </p>
        )}
        <fieldset
          className="auth-journey-fields"
          disabled={busy}
          key={currentStep}
        >
          {currentStep === "email" && (
            <>
              <label htmlFor="email">{t.email}</label>
              <input
                id="email"
                name="username"
                type="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
            </>
          )}
          {currentStep === "password" && (
            <>
              <input
                type="hidden"
                name="username"
                autoComplete="username"
                value={email}
              />
              <label htmlFor="password">{t.password}</label>
              <div className="auth-password-field">
                <input
                  id="password"
                  name="password"
                  type={visiblePassword ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 8 : undefined}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                />
                <button
                  type="button"
                  className="auth-password-visibility"
                  aria-label={
                    visiblePassword ? words.hidePassword : words.showPassword
                  }
                  aria-pressed={visiblePassword}
                  onClick={() => setVisiblePassword(!visiblePassword)}
                >
                  {visiblePassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {register && (
                <small className="auth-field-hint">{words.passwordHint}</small>
              )}
              {!register && (
                <button
                  className="auth-inline-action auth-reset"
                  type="button"
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
            </>
          )}
          {currentStep === "profile" && (
            <>
              {!pendingGoogle && (
                <>
                  <label htmlFor="name">{pageText[language].name}</label>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    dir="auto"
                  />
                </>
              )}
              <div className="auth-age-group">
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
                    if (
                      value === "" ||
                      value === "under16" ||
                      value === "16plus"
                    )
                      setAgeBand(value);
                  }}
                />
                <small>{eligibility.hint}</small>
                {ageBand === "under16" && (
                  <p className="notice" role="status">
                    {eligibility.blocked}
                  </p>
                )}
              </div>
            </>
          )}
        </fieldset>
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
          type="submit"
          className="primary-button auth-continue"
          disabled={
            busy ||
            (currentStep === "profile" &&
              (!eligible || (!pendingGoogle && !name.trim())))
          }
        >
          {busy
            ? words.working
            : currentStep === "email" ||
                (register && currentStep === "password")
              ? words.continue
              : creating
                ? t.signUp
                : t.signIn}
        </button>
        {currentStep === "email" && (
          <>
            <div className="auth-journey-divider">
              <span>{words.or}</span>
            </div>
            <button
              type="button"
              className="secondary-button auth-google"
              disabled={busy}
              onClick={google}
            >
              <svg
                aria-hidden="true"
                width="19"
                height="19"
                viewBox="0 0 24 24"
              >
                <path
                  fill="#4285F4"
                  d="M22.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h6a5.2 5.2 0 0 1-2.2 3.4v2.8h3.6c2.1-2 3.2-4.8 3.2-8.2Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3 0 5.6-1 7.4-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11.2 11.2 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.7 14a6.7 6.7 0 0 1 0-4V7H2a11 11 0 0 0 0 10l3.7-3Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.4c1.7 0 3.1.6 4.3 1.7l3.2-3.2A10.6 10.6 0 0 0 12 1 11.2 11.2 0 0 0 2 7l3.7 3c.9-2.6 3.4-4.6 6.3-4.6Z"
                />
              </svg>
              {t.google}
            </button>
          </>
        )}
      </form>
      <div className="auth-journey-switch">
        <span>
          {pendingGoogle
            ? words.pending
            : register
              ? words.haveAccount
              : words.noAccount}
        </span>
        <button
          type="button"
          className="auth-inline-action"
          disabled={busy}
          onClick={() => {
            if (pendingGoogle) {
              void perform(async () => {
                cancelEntryAudio();
                await signOut(auth!);
                setPendingGoogle(null);
                setRegister(false);
                setStep("email");
                setPassword("");
                setAgeBand("");
                releaseAuthEntry();
              });
              return;
            }
            changeMode();
          }}
        >
          {pendingGoogle ? words.cancel : register ? t.signIn : t.signUp}
        </button>
      </div>
    </section>
  );
}
