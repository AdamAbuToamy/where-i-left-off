import { expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const scanner = resolve('scripts/check-credentials.mjs')
function scan(credential = '') {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-credential-check-'))
  try {
    mkdirSync(join(directory, 'src')); mkdirSync(join(directory, 'public'))
    writeFileSync(join(directory, 'src', 'main.ts'), 'export const ready = true')
    writeFileSync(join(directory, '.env.local'), 'VITE_FIREBASE_PROJECT_ID=example-project')
    if (credential) writeFileSync(join(directory, 'public', 'unexpected.txt'), credential)
    return spawnSync(process.execPath, [scanner], { cwd: directory, encoding: 'utf8', timeout: 10000 })
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
it('checks source archives without requiring a Git checkout', () => {
  const result = scan()
  expect(result.status).toBe(0); expect(result.stdout).toContain('check passed')
})
it('rejects private credential material in browser assets without echoing it', () => {
  const credential = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ')
  const result = scan(credential)
  expect(result.status).toBe(1); expect(result.stderr).toContain('public/unexpected.txt')
  expect(result.stderr).not.toContain(credential)
})
