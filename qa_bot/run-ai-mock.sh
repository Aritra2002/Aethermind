#!/usr/bin/env bash
# AI pipeline regression check for `npm run test:ai-mock`:
#   1. vitest layer — replays canned SSE streams through the adapter + parser
#      (src/__tests__/ai-askai-stream-staging.test.ts, ai-actions-safety.test.ts)
#   2. browser layer — qa_bot/_f2_mock.py drives the real app with a local
#      mock-SSE server: fenced/unfenced/pure action JSON must stage -> Apply ->
#      persist, and the editor Auto-Tag strip must show waiting -> reasoning ->
#      applied tags (screenshots saved under qa_bot/screenshots/).
# The Vite dev server is started on demand and stopped again if we started it.
set -uo pipefail
cd "$(dirname "$0")/.."

PY=".venv/Scripts/python.exe"        # Windows venv
[ -x "$PY" ] || PY=".venv/bin/python" # POSIX venv
[ -x "$PY" ] || PY="python"           # CI / system

echo "== [1/2] vitest: AI streaming + action-staging pipeline =="
npx vitest run \
  src/__tests__/ai-askai-stream-staging.test.ts \
  src/__tests__/ai-actions-safety.test.ts || exit 1

echo "== [2/2] Playwright mock-SSE browser scenarios =="
STARTED_VITE=0
if ! curl -s -o /dev/null -m 3 http://localhost:5173/Aethermind/; then
  STARTED_VITE=1
  (npm run dev > /tmp/ai-mock-vite.log 2>&1 &)
  ok=0
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null -m 2 http://localhost:5173/Aethermind/; then ok=1; break; fi
    sleep 2
  done
  if [ "$ok" != "1" ]; then
    echo "ERROR: dev server did not become ready"
    tail -5 /tmp/ai-mock-vite.log
    exit 1
  fi
fi

"$PY" qa_bot/_f2_mock.py
RC=$?

if [ "$STARTED_VITE" = "1" ]; then
  pkill -f "vite" >/dev/null 2>&1 || true
fi
exit $RC