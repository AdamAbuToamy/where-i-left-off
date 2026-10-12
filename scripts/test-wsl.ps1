param([int]$Runs = 3)
if ($Runs -lt 1 -or $Runs -gt 10) { throw 'Runs must be between 1 and 10.' }
$log = Join-Path $env:USERPROFILE ('Downloads\where-i-left-off-wsl-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
# Save on Windows: the transcript remains available if the Linux VM terminates.
$script = @'
source ~/.nvm/nvm.sh || exit 1
cd ~/projects/where-i-left-off || exit 1
set -euo pipefail
export VITE_TEST_OFFLINE=false
export TEST_SOFTWARE_RENDERING=1
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
java -version
npm run test:tooling
npm audit --audit-level=high
npm run lint
npm test
npm run test:rules
VITE_USE_EMULATORS=true VITE_TEST_OFFLINE=true npm run build
for (( run=1; run<=RECALL_RUNS; run++ )); do
  echo "BROWSER_RUN=$run"
  ./node_modules/.bin/firebase emulators:exec --project demo-where-i-left-off --only auth,firestore "./node_modules/.bin/playwright test --workers=1 --reporter=line"
done
VITE_USE_EMULATORS=false VITE_TEST_OFFLINE=false npm run build
echo RECALL_VERIFICATION_COMPLETE
'@
$script = $script.Replace('RECALL_RUNS', [string]$Runs).Replace("`r", '')
$script | wsl.exe -d Ubuntu -- bash -s 2>&1 | Tee-Object -FilePath $log
$result = $LASTEXITCODE
Write-Host "WSL_EXIT_CODE=$result"
Write-Host "Log: $log"
if ($result -ne 0) { throw 'Verification failed. Keep the Windows log; do not repeat the command blindly.' }
