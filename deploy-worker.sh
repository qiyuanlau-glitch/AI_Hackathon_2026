#!/usr/bin/env bash
# Build ./dist and deploy the ai-hackathon-2026 Worker (the live site at
# ai-hackathon-2026.junyu-choo.workers.dev). wrangler.jsonc serves ./dist via
# the ASSETS binding and worker.js handles /agent-proxy.
#
# Usage:  ./deploy-worker.sh   (or: npm run deploy)
# Requires: wrangler logged in (npx wrangler login).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Wrangler needs Node >=22. Load nvm and select the version pinned in .nvmrc (22)
# so this works even when the shell defaults to an older Node.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use >/dev/null 2>&1 || true
fi

echo "Using $(node -v) → building ./dist and deploying Worker…"
node "$ROOT/build.mjs"
npx --no-install wrangler deploy
