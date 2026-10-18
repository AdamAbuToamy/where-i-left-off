import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const env = import.meta.env
export const emulatorMode = env.VITE_USE_EMULATORS === 'true'
const config = emulatorMode ? {
  apiKey: 'demo-key', authDomain: 'demo-where-i-left-off.firebaseapp.com', projectId: 'demo-where-i-left-off', appId: 'demo-app',
} : {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}
export const configured = Object.values(config).every(Boolean)
const app = configured ? initializeApp(config) : null
// App Check is enabled only for production builds with a registered public site key.
// Do not enforce in Firebase Console until verified requests appear in metrics.
const appCheckSiteKey = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim()
if (app && !emulatorMode && env.PROD && appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
if (emulatorMode && auth && db) {
  const host = env.VITE_EMULATOR_HOST || '127.0.0.1'
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
}
