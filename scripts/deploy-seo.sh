#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[[ -x node_modules/.bin/firebase ]] || npm ci --no-audit --no-fund
node --input-type=module <<'NODE'
import { loadEnv } from 'vite'
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const keys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
if (keys.some(key => !env[key]?.trim())) throw new Error('Missing production Firebase web configuration. Set .env.local before deployment.')
if (env.VITE_FIREBASE_PROJECT_ID !== 'where-i-left-off-b5683') throw new Error('Unexpected Firebase project; deployment stopped.')
NODE
VITE_USE_EMULATORS=false VITE_TEST_OFFLINE=false npm run build
./node_modules/.bin/firebase deploy --only hosting:production --project where-i-left-off-b5683
