import { expect, it } from 'vitest'
import { assertPublicEnvironment, readClientConfiguration } from '../src/lib/clientConfiguration'
const configured = {
  VITE_FIREBASE_API_KEY: `AIza${'a'.repeat(35)}`,
  VITE_FIREBASE_PROJECT_ID: 'example-project', VITE_FIREBASE_AUTH_DOMAIN: 'example-project.firebaseapp.com',
  VITE_FIREBASE_APP_ID: '1:123456:web:abcdef123',
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: 'public_site_identifier_12345',
}
it('returns only browser configuration and never forwards server credentials', () => {
  const result = readClientConfiguration({ ...configured, FIREBASE_SERVICE_ACCOUNT: 'SERVER_ONLY_SENTINEL', SMTP_CONFIG: 'SMTP_SENTINEL' })
  expect(result.firebase?.projectId).toBe('example-project')
  expect(JSON.stringify(result)).not.toContain('SENTINEL')
})
it('rejects unreviewed public variables and credential material with safe errors', () => {
  for (const env of [
    { VITE_SMTP_PASSWORD: 'DO_NOT_ECHO' },
    { VITE_FIREBASE_API_KEY: ['DO_NOT_ECHO'] },
    { VITE_FIREBASE_API_KEY: ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') },
  ]) {
    try { assertPublicEnvironment(env); throw new Error('did-not-reject') }
    catch (error) { expect(error).toMatchObject({ message: 'invalid-configuration', code: 'invalid-configuration' }); expect(String(error)).not.toContain('DO_NOT_ECHO') }
  }
})
it('supports setup mode and isolates emulator mode from real Firebase settings', () => {
  expect(readClientConfiguration({}).firebase).toBeNull()
  expect(readClientConfiguration({ ...configured, VITE_USE_EMULATORS: 'true' }).firebase?.projectId).toBe('demo-where-i-left-off')
})
it('requires real configuration and a public App Check site key for protected production builds', () => {
  expect(() => readClientConfiguration({ VITE_REQUIRE_FIREBASE_CONFIG: 'true' })).toThrow('invalid-configuration')
  expect(() => readClientConfiguration({ ...configured, VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: '', VITE_REQUIRE_APP_CHECK: 'true' })).toThrow('invalid-configuration')
  expect(() => readClientConfiguration({ ...configured, VITE_REQUIRE_APP_CHECK: 'true' })).not.toThrow()
  expect(() => readClientConfiguration({ ...configured, VITE_USE_EMULATORS: 'true', VITE_REQUIRE_APP_CHECK: 'true' })).toThrow('invalid-configuration')
})
it('rejects malformed booleans, credential-bearing domains and invalid identifiers', () => {
  for (const patch of [
    { VITE_USE_EMULATORS: 'TRUE' }, { VITE_EMULATOR_HOST: 'https://example.test/path' },
    { VITE_FIREBASE_AUTH_DOMAIN: 'user:password@example.test' },
    { VITE_FIREBASE_AUTH_DOMAIN: 'example.test/path' }, { VITE_FIREBASE_APP_ID: 'not-an-app-id' },
    { VITE_FIREBASE_PROJECT_ID: '../other-project' }, { VITE_FIREBASE_API_KEY: 'server-key' },
  ]) expect(() => readClientConfiguration({ ...configured, ...patch })).toThrow('invalid-configuration')
})
