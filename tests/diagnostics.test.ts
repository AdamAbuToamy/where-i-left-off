import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../src/lib/firebase', () => ({ auth: { currentUser: { uid: 'alice' } }, db: null, emulatorMode: false }))
import { logEvent, readLogs, safeCode, safeSource } from '../src/lib/logging'
import { validName, displayName } from '../src/lib/profile'
import { isProtectedAdminAccount } from '../src/lib/admin'
import { route } from '../src/lib/navigation'
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) || null, setItem: (key: string, value: string) => store.set(key, value) })
  vi.stubGlobal('location', { hash: '#/groups/abcdefghijklmnopqrst?token=secret', origin: 'https://example.test' })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
})
describe('diagnostics privacy and navigation', () => {
  it('records fixed metadata, redacts group identity and never serializes sensitive error messages', () => {
    const error = Object.assign(new Error('password=SECRET email=private@example.test https://example.test/?token=SECRET'), { code: 'auth/invalid-credential', payload: 'SECRET' })
    logEvent('auth.failed', error)
    const [entry] = readLogs('alice')
    expect(entry.code).toBe('auth/invalid-credential')
    expect(entry.page).toBe('#/groups/:group')
    expect(entry.uid).toBe('alice')
    expect(JSON.stringify(entry)).not.toMatch(/SECRET|private@example|payload|password/)
    expect(readLogs('bob')).toEqual([])
  })
  it('deduplicates repeated errors and keeps a bounded device buffer', () => {
    const id = logEvent('duplicate', new Error('secret'))
    expect(id).not.toBe('')
    expect(logEvent('duplicate', new Error('secret'))).toBe('')
    for (let i = 0; i < 210; i++) logEvent(`event.${i}`, { code: 'unavailable' })
    expect(readLogs('alice')).toHaveLength(200)
  })
  it('uses safe codes and rejects malformed code values', () => {
    expect(safeCode({ code: 'token=secret@example.test' })).toBe('unknown')
    expect(safeCode(new Error('permission-denied'))).toBe('permission-denied')
    expect(safeCode(new Error('private detail'))).toBe('Error')
  })
  it('keeps source locations without error messages, URL tokens or external frames', () => {
    const error = new Error('password=SECRET')
    error.stack = 'Error: password=SECRET\n at action (https://example.test/assets/index-release.js?token=SECRET:12:34)\n at external (https://other.test/assets/external.js:10:20)'
    expect(safeSource(error)).toBe('/assets/index-release.js:12:34')
  })
  it('separates personal pages from group deep links and rejects invalid group IDs', () => {
    expect(route('#/personal')).toEqual({ page: 'personal', groupId: '' })
    expect(route('#/groups/abcdefghijklmnopqrst')).toEqual({ page: 'groups', groupId: 'abcdefghijklmnopqrst' })
    expect(route('#/groups/bad')).toEqual({ page: 'groups', groupId: '' })
    expect(route('#/settings')).toEqual({ page: 'settings', groupId: '' })
    expect(route('#/admin/logs')).toEqual({ page: 'admin', groupId: '' })
    expect(route('#/unknown')).toEqual({ page: 'personal', groupId: '' })
  })
  it('protects the administrator account regardless of email case and whitespace', () => {
    expect(isProtectedAdminAccount(' adam2002hosny@gmail.com ')).toBe(true)
    expect(isProtectedAdminAccount('ADAM2002HOSNY@GMAIL.COM')).toBe(true)
    expect(isProtectedAdminAccount('other@example.test')).toBe(false)
    expect(isProtectedAdminAccount(undefined)).toBe(false)
  })
  it('requires an actual name and never falls back to exposing an email', () => {
    expect(validName('   ')).toBe(false)
    expect(validName('x'.repeat(101))).toBe(false)
    expect(validName(' آدم ')).toBe(true)
    expect(displayName({ displayName: null })).toBe('Member')
    expect(displayName({ displayName: ' آدم ' })).toBe('آدم')
  })
})
