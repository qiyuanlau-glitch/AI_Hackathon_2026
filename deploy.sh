#!/usr/bin/env bash
# Deploy the static site + the /agent-proxy Pages Function to Cloudflare Pages.
#
# Why staging: Cloudflare deploys whatever directory you point at, and serving the
# repo root would sweep in node_modules (119 MiB workerd > the 25 MiB limit). We
# copy only web assets + functions/ into a temp dir and deploy that.
#
# Usage:  ./deploy.sh
# Requires: wrangler logged in (npx wrangler login).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="lessen-hoa"

# Wrangler needs Node >=22. Load nvm and select the version pinned in .nvmrc (22).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use >/dev/null 2>&1 || true
fi
STAGE="$(mktemp -d)/site"
mkdir -p "$STAGE"

rsync -a \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.claude' \
  --exclude '.superpowers' \
  --exclude 'docs' \
  --exclude 'supabase' \
  --exclude '.env' --exclude '.env.local' --exclude '.env.example' \
  --exclude '*.cjs' \
  --exclude '*probe*.js' \
  --exclude 'package.json' --exclude 'package-lock.json' \
  --exclude '.gitignore' \
  --exclude 'CONTEXT.md' \
  --exclude 'deploy.sh' \
  --exclude '.DS_Store' \
  "$ROOT/" "$STAGE/"

echo "Staged $(du -sh "$STAGE" | cut -f1) → deploying to Cloudflare Pages project '$PROJECT'…"
cd "$ROOT"
npx --no-install wrangler pages deploy "$STAGE" --project-name="$PROJECT" --branch=main --commit-dirty=true
