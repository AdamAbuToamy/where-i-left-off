// Recover only public browser configuration from the existing production site.
// Service-account credentials stay in GitHub's encrypted secrets, never in this file.
import { writeFile } from 'node:fs/promises'
const origin = 'https://where-i-left-off.web.app'
async function read(path, json = false) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Production configuration request failed: ${response.status}`)
  return json ? response.json() : response.text()
}
const config = await read('/__/firebase/init.json', true)
if (config.projectId !== 'where-i-left-off-b5683') throw new Error('Unexpected Firebase project; stopping deployment.')
const html = await read('/')
const entry = html.match(/<script\b[^>]*\bsrc="(\/assets\/[^"?#]+\.js)"/i)?.[1]
if (!entry) throw new Error('Cannot identify the current production browser entry.')
const bundle = await read(entry)
const key = bundle.match(/VITE_RECAPTCHA_ENTERPRISE_SITE_KEY\s*:\s*[`"']([A-Za-z0-9_-]+)[`"']/)?.[1]
if (!key) throw new Error('Cannot preserve the current App Check site key; stopping deployment.')
const env = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: key,
  VITE_APP_CHECK_PROVIDER: bundle.match(/VITE_APP_CHECK_PROVIDER\s*:\s*[`"'](recaptcha-enterprise|recaptcha-v3)[`"']/)?.[1] || 'recaptcha-enterprise',
  VITE_USE_EMULATORS: 'false',
  VITE_TEST_OFFLINE: 'false',
  VITE_ASSISTANT_ENABLED: 'true',
  VITE_REQUIRE_APP_CHECK: 'true',
  VITE_REQUIRE_FIREBASE_CONFIG: 'true',
}
for (const [name, value] of Object.entries(env)) {
  if (typeof value !== 'string' || !value || /[\r\n]/.test(value)) throw new Error(`Invalid browser configuration: ${name}`)
}
await writeFile('.env.production.local', Object.entries(env).map(([name,value])=>`${name}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 })
console.log('Production browser configuration verified; existing App Check preserved.')
