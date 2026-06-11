#!/usr/bin/env bash
# Cloudflare Workers (Git) build step. Delegates to build.mjs, which stages the
# web assets into ./dist using Node's fs (Cloudflare's build container has Node
# but not rsync/tar). wrangler.jsonc serves ./dist via the ASSETS binding and
# worker.js handles /agent-proxy.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$ROOT/build.mjs"
