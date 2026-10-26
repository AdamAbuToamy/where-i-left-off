#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; fi
probe_pid=''
cleanup() { if [ -n "$probe_pid" ]; then kill "$probe_pid" 2>/dev/null || true; fi; }
trap cleanup EXIT
if ! curl -fsS http://127.0.0.1:8177/__cases >/dev/null 2>&1; then
 node scripts/serve-assistant-probe.mjs >/tmp/wilo-browser-probe.log 2>&1 &
 probe_pid=$!
 for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8177/__cases >/dev/null 2>&1; then break; fi
  sleep 1
 done
fi
nodewin="${WILO_WINDOWS_NODE:-/mnt/c/Program Files/nodejs/node.exe}"
scriptwin="$(wslpath -w "$PWD/scripts/test-assistant-windows.mjs")"
scriptwin="${scriptwin/wsl.localhost/wsl\$}"
"$nodewin" "$scriptwin" "$@"