#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
CLI=./node_modules/.bin/firebase
[[ -x "$CLI" ]] || { echo 'Firebase CLI غير موجود؛ شغّل npm ci أولًا.' >&2; exit 1; }
"$CLI" target:apply hosting production where-i-left-off --project where-i-left-off-b5683
node <<'NODE'
const fs = require('node:fs')
const filename = 'firebase.json'
const config = JSON.parse(fs.readFileSync(filename, 'utf8'))
const hosting = Array.isArray(config.hosting) ? config.hosting.find(item => item.public === 'dist') : config.hosting
if (!hosting || hosting.public !== 'dist') throw new Error('لم أجد إعداد استضافة dist')
delete hosting.site
hosting.target = 'production'
fs.writeFileSync(filename, JSON.stringify(config, null, 2) + '\n')
NODE
VITE_USE_EMULATORS=false VITE_TEST_OFFLINE=false npm run build
"$CLI" deploy --only hosting:production,firestore:rules,firestore:indexes --project where-i-left-off-b5683
