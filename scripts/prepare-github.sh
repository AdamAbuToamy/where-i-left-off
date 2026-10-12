#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ ! -d .git ]]; then git init -b main; fi
# Explicit source paths: never stage everything in a folder containing credentials/backups.
for path in src public scripts tests browser-extension .github package.json package-lock.json index.html vite.config.ts vitest.config.ts playwright.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js firestore.rules firebase.json .gitignore .env.example README.md SECURITY.md TEST_RESULTS.md; do
  if [[ -e "$path" ]]; then git add -- "$path"; fi
done
node scripts/check-public-source.mjs
git diff --cached --stat
printf '\nتم تجهيز الملفات محليًا فقط. راجع: git diff --cached\nلم يتم إنشاء commit أو رفع ملفات إلى GitHub.\n'
