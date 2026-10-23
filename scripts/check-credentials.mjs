import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

function sourceFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(name => name && existsSync(name))
  } catch {
    // Downloaded source archives have no Git metadata. Local .env files are
    // expected here; their public values are validated separately by Vite.
    return [
      ...readdirSync('.', { withFileTypes: true }).filter(entry => entry.isFile() && (!entry.name.startsWith('.env') || entry.name === '.env.example')).map(entry => entry.name),
      ...['scripts', 'tests', 'docs', '.github'].flatMap(collect),
    ]
  }
}
const names = sourceFiles()
// Also inspect untracked browser assets: Vite copies public/ into deployments.
function collect(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`
    if (entry.isSymbolicLink()) throw new Error('Browser source/assets must not contain symbolic links.')
    return entry.isDirectory() ? collect(path) : [path]
  })
}
const paths = [...new Set([...names, ...collect('src'), ...collect('public'), ...(process.argv.includes('--dist') ? collect('dist') : [])])]
const credential = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|(?<![A-Za-z0-9+/])AKIA[0-9A-Z]{16}(?![A-Za-z0-9+/])|sk-(?:proj-)?[A-Za-z0-9_-]{40,}/
const failures = []
for (const name of paths) {
  const base = name.split('/').at(-1)
  if ((base.startsWith('.env') && base !== '.env.example') || /service.?account.*\.json$|\.(pem|key)$/i.test(name)) {
    failures.push(name)
    continue
  }
  const bytes = readFileSync(name)
  if (!bytes.includes(0) && credential.test(bytes.toString('utf8'))) failures.push(name)
}
if (failures.length) {
  // Report filenames only. Never echo matched credentials, even in CI logs.
  for (const name of failures) console.error(`Credential review required: ${name}`)
  process.exitCode = 1
} else console.log(`Credential pattern check passed for ${paths.length} source/asset files. This is not a complete secret scanner.`)
