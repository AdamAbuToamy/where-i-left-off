import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
// Check staged bytes, not the working tree. This is a guard, not a complete secret scanner.
const names = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
let failed = false
for (const name of names) {
  const base = name.split('/').at(-1)
  const badName = (base?.startsWith('.env') && base !== '.env.example')
    || /(^|\/)(node_modules|dist|test-results|playwright-report|\.firebase)(\/|$)|service.?account.*\.json$|\.(pem|key|log|zip|tar\.gz)$/i.test(name)
  const bytes = execFileSync('git', ['show', `:${name}`], { maxBuffer: 20 * 1024 * 1024 })
  const text = bytes.includes(0) ? '' : bytes.toString('utf8')
  const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(text)
  if (badName || secret) { console.error(`Blocked staged file: ${name}`); failed = true }
}
if (failed) process.exitCode = 1
else console.log(`Checked ${names.length} staged files. Review git diff --cached before publishing.`)
// Ensure this command can run without production credentials.
JSON.parse(readFileSync('package.json', 'utf8'))
