import { readFile, writeFile } from 'node:fs/promises'
const filename = new URL('../package.json', import.meta.url)
const p = JSON.parse(await readFile(filename, 'utf8'))
p.scripts.build = 'tsc -b && vite build && node scripts/generate-sw.mjs'
p.scripts['test:e2e'] = 'VITE_USE_EMULATORS=true VITE_TEST_OFFLINE=true vite build && node scripts/generate-sw.mjs && firebase emulators:exec --project demo-where-i-left-off --only auth,firestore "playwright test"'
p.scripts['test:rules'] = 'firebase emulators:exec --project demo-where-i-left-off --only firestore "env TEST_SUITE=security vitest run"'
p.scripts['test:all'] = 'npm run lint && npm test && npm run test:rules && npm run test:e2e && VITE_USE_EMULATORS=false npm run build'
await writeFile(filename, JSON.stringify(p, null, 2) + '\n')
