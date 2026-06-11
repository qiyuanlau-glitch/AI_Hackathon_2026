#!/usr/bin/env bash
# Cloudflare Pages (Git) build step.
#
# Why: Cloudflare runs `npm install` when it sees package.json, which pulls
# wrangler/workerd (~119 MiB) into node_modules. Deploying the repo root would
# sweep that in and blow the asset limit. So we stage ONLY the web assets into
# ./dist and point Cloudflare's "build output directory" at it.
#
# functions/ stays at the repo root — Pages detects it there independently of
# the build output directory, so it is intentionally NOT copied into dist.
#
# Mirrors deploy.sh (the manual wrangler path) so behaviour is identical.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$ROOT/dist"

rm -rf "$OUT"
mkdir -p "$OUT"

rsync -a \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'functions' \
  --exclude 'worker.js' \
  --exclude 'wrangler.jsonc' --exclude 'wrangler.toml' \
  --exclude '.git' \
  --exclude '.claude' \
  --exclude '.superpowers' \
  --exclude '.wrangler' \
  --exclude 'docs' \
  --exclude 'supabase' \
  --exclude '.env' --exclude '.env.local' --exclude '.env.example' \
  --exclude '*.cjs' \
  --exclude '*probe*.js' \
  --exclude 'package.json' --exclude 'package-lock.json' \
  --exclude '.gitignore' \
  --exclude 'CONTEXT.md' \
  --exclude 'build.sh' --exclude 'deploy.sh' \
  --exclude '.DS_Store' \
  "$ROOT/" "$OUT/"

echo "Staged $(du -sh "$OUT" | cut -f1) into dist/ for the Cloudflare Worker (served via the ASSETS binding)."
