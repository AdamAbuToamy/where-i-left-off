import { readClientConfiguration } from './clientConfiguration'
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const runtime = readClientConfiguration(import.meta.env)
export const emulatorMode = runtime.emulatorMode
export const configured = runtime.firebase !== null
const app = runtime.firebase ? initializeApp(runtime.firebase) : null
// The site key is public. Enforcement and accepted domains live in Firebase/Google Cloud.
const appCheckSiteKey = runtime.appCheckSiteKey
export const appCheck = app && !emulatorMode && import.meta.env.PROD && appCheckSiteKey
  ? initializeAppCheck(app, {
    provider: runtime.appCheckProvider === 'recaptcha-v3' ? new ReCaptchaV3Provider(appCheckSiteKey) : new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  }) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
if (emulatorMode && auth && db) {
  const host = runtime.emulatorHost
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
}
