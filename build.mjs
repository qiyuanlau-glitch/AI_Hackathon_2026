// Cloudflare Workers build step (invoked by build.sh).
//
// Stages ONLY the web assets into ./dist, which wrangler.jsonc serves via the
// ASSETS binding. Uses Node's fs (no rsync/tar) so it runs in Cloudflare's
// minimal build container. functions/ is intentionally excluded — the proxy
// now lives in worker.js. Mirrors deploy.sh's old rsync excludes.
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const ROOT = import.meta.dirname;
const OUT = resolve(ROOT, 'dist');

// Top-level entries (and a few file names) that must never reach the deploy.
const EXCLUDE = new Set([
  'node_modules', 'dist', 'functions', '.git', '.claude', '.superpowers',
  '.wrangler', 'docs', 'supabase', '.env', '.env.local', '.env.example',
  '.gitignore', 'CONTEXT.md', 'build.sh', 'build.mjs', 'deploy.sh',
  'worker.js', 'wrangler.jsonc', 'wrangler.toml',
  'package.json', 'package-lock.json', '.DS_Store',
]);

// Files that must never be served, anywhere in the tree.
function keep(src) {
  const base = src.split(sep).pop();
  if (base.endsWith('.cjs')) return false;            // local-only proxies
  if (base.endsWith('.js') && base.includes('probe')) return false; // test probes
  if (base === '.DS_Store') return false;
  return true;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Copy each allowed top-level entry into dist (cpSync can't copy a dir into its
// own subdirectory, so we never copy ROOT wholesale).
let count = 0;
for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
  if (EXCLUDE.has(entry.name)) continue;
  if (!keep(entry.name)) continue;
  cpSync(resolve(ROOT, entry.name), resolve(OUT, entry.name), { recursive: true, filter: keep });
  count++;
}

console.log(`Staged ${count} top-level entries into ${OUT} for the Cloudflare Worker (ASSETS binding).`);
