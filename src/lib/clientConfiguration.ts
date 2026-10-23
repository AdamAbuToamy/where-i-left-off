import { ConfigurationError } from './appError.ts'

export const PUBLIC_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID',
  'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'VITE_USE_EMULATORS', 'VITE_EMULATOR_HOST', 'VITE_TEST_OFFLINE',
  'VITE_REQUIRE_APP_CHECK', 'VITE_REQUIRE_FIREBASE_CONFIG', 'VITE_APP_CHECK_PROVIDER',
] as const

type Environment = Record<string, unknown>
export type FirebaseClientOptions = { apiKey: string; authDomain: string; projectId: string; appId: string }
export type ClientConfiguration = {
  firebase: FirebaseClientOptions | null
  emulatorMode: boolean
  emulatorHost: string
  appCheckSiteKey: string
  appCheckProvider: 'recaptcha-enterprise' | 'recaptcha-v3'
}

/** VITE values are public. Reject new exposure until it is explicitly reviewed. */
export function assertPublicEnvironment(env: Environment): void {
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('VITE_')) continue
    if (!(PUBLIC_ENV_KEYS as readonly string[]).includes(key)) throw new ConfigurationError()
    if (typeof value !== 'string') throw new ConfigurationError()
    if (/PRIVATE KEY|"private_key"|"type"\s*:\s*"service_account"|^(?:sk-|ghp_|github_pat_)/.test(value)) throw new ConfigurationError()
  }
}

function text(env: Environment, key: string): string {
  const value = env[key]
  if (value === undefined) return ''
  if (typeof value !== 'string') throw new ConfigurationError()
  const trimmed = value.trim()
  if (trimmed.length > 500 || /[\r\n\0]/.test(trimmed)) throw new ConfigurationError()
  return trimmed
}
function flag(env: Environment, key: string): boolean {
  const value = text(env, key)
  if (value && value !== 'true' && value !== 'false') throw new ConfigurationError()
  return value === 'true'
}

export function readClientConfiguration(env: Environment): ClientConfiguration {
  assertPublicEnvironment(env)
  const emulatorMode = flag(env, 'VITE_USE_EMULATORS')
  flag(env, 'VITE_TEST_OFFLINE')
  const requireAppCheck = flag(env, 'VITE_REQUIRE_APP_CHECK')
  const requireFirebase = flag(env, 'VITE_REQUIRE_FIREBASE_CONFIG')
  const emulatorHost = text(env, 'VITE_EMULATOR_HOST') || '127.0.0.1'
  if (!/^(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(emulatorHost)) throw new ConfigurationError()
  const appCheckProvider = text(env, 'VITE_APP_CHECK_PROVIDER') || 'recaptcha-enterprise'
  if (appCheckProvider !== 'recaptcha-enterprise' && appCheckProvider !== 'recaptcha-v3') throw new ConfigurationError()
  const appCheckSiteKey = text(env, 'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY')
  if (appCheckSiteKey && !/^[A-Za-z0-9_-]{20,200}$/.test(appCheckSiteKey)) throw new ConfigurationError()
  if (emulatorMode) {
    if (requireAppCheck || requireFirebase) throw new ConfigurationError()
    return {
      emulatorMode, emulatorHost, appCheckSiteKey: '', appCheckProvider,
      firebase: { apiKey: 'demo-key', authDomain: 'demo-where-i-left-off.firebaseapp.com', projectId: 'demo-where-i-left-off', appId: 'demo-app' },
    }
  }
  const firebase = {
    apiKey: text(env, 'VITE_FIREBASE_API_KEY'), authDomain: text(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: text(env, 'VITE_FIREBASE_PROJECT_ID'), appId: text(env, 'VITE_FIREBASE_APP_ID'),
  }
  if (firebase.apiKey && !/^AIza[A-Za-z0-9_-]{30,60}$/.test(firebase.apiKey)) throw new ConfigurationError()
  if (firebase.projectId && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(firebase.projectId)) throw new ConfigurationError()
  if (firebase.appId && !/^\d+:\d+:web:[A-Za-z0-9_-]+$/.test(firebase.appId)) throw new ConfigurationError()
  if (firebase.authDomain) {
    try {
      const url = new URL(`https://${firebase.authDomain}`)
      if (url.hostname !== firebase.authDomain || !url.hostname.includes('.') || url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new ConfigurationError()
    } catch { throw new ConfigurationError() }
  }
  const configured = Object.values(firebase).every(Boolean)
  if ((requireFirebase && !configured) || (requireAppCheck && (!configured || !appCheckSiteKey))) throw new ConfigurationError()
  return { firebase: configured ? firebase : null, emulatorMode, emulatorHost, appCheckSiteKey, appCheckProvider }
}
