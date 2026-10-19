import { createInterface } from 'node:readline/promises'
import { readFile, writeFile, copyFile, chmod } from 'node:fs/promises'
const rl = createInterface({ input: process.stdin, output: process.stdout })
try {
  console.log('Firebase Spark — enter the Web app settings from Firebase Console. No service-account keys.')
  const projectId = (await rl.question('Project ID: ')).trim()
  const apiKey = (await rl.question('Web API key: ')).trim()
  const appId = (await rl.question('Web App ID: ')).trim()
  const domainInput = (await rl.question(`Auth domain [${projectId}.firebaseapp.com]: `)).trim()
  const authDomain = domainInput || `${projectId}.firebaseapp.com`
  const appCheckSiteKey = (await rl.question('Public reCAPTCHA Enterprise SITE key (required for production deployment; blank to configure later): ')).trim()
  if (![projectId, apiKey, appId, authDomain, ...(appCheckSiteKey ? [appCheckSiteKey] : [])].every(s => s && !/[\r\n\s"'#]/.test(s))) throw new Error('Invalid or empty setting.')
  try { await readFile('.env.local'); await copyFile('.env.local', `.env.local.backup-${Date.now()}`) } catch (e) { if (e.code !== 'ENOENT') throw e }
  await writeFile('.env.local', `VITE_FIREBASE_PROJECT_ID=${projectId}\nVITE_FIREBASE_API_KEY=${apiKey}\nVITE_FIREBASE_APP_ID=${appId}\nVITE_FIREBASE_AUTH_DOMAIN=${authDomain}\nVITE_RECAPTCHA_ENTERPRISE_SITE_KEY=${appCheckSiteKey}\nVITE_USE_EMULATORS=false\n`, { mode: 0o600 })
  await chmod('.env.local', 0o600)
  console.log('Saved .env.local. Restart npm run dev. Deploy firestore.rules before using real accounts.')
} finally { rl.close() }
