#!/usr/bin/env node
const http = require('http');
const path = require('path');
const fs = require('fs/promises');
const { corsHeaders, forwardAgentRequest, readRequestBody } = require('./agent-proxy-core.cjs');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const PROXY_PATH = '/agent-proxy';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
};

function parseEnvText(text){
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines){
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex <= 0) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ){
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined){
      process.env[key] = value;
    }
  }
}

async function loadEnvFiles(){
  const envFiles = ['.env', '.env.local'];
  for (const fileName of envFiles){
    const filePath = path.join(ROOT, fileName);
    try {
      const text = await fs.readFile(filePath, 'utf8');
      parseEnvText(text);
      console.log(`Loaded env from ${fileName}`);
    } catch {
      // Ignore missing env files.
    }
  }
}

function send(res, statusCode, headers, body){
  res.writeHead(statusCode, headers);
  res.end(body);
}

async function handleProxy(req, res){
  const headers = {
    ...corsHeaders(),
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return send(res, 204, headers, '');
  if (req.method !== 'POST'){
    return send(res, 405, headers, JSON.stringify({ proxy: true, ok: false, error: 'Method not allowed.' }));
  }

  try {
    const input = await readRequestBody(req);
    const result = await forwardAgentRequest(input);
    send(res, 200, headers, JSON.stringify(result));
  } catch (error) {
    send(res, error.statusCode || 502, headers, JSON.stringify({
      proxy: true,
      ok: false,
      status: error.statusCode || 502,
      statusText: 'Proxy Error',
      error: error.message || String(error),
    }));
  }
}

async function handleStatic(req, res){
  if (req.method !== 'GET' && req.method !== 'HEAD'){
    return send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Method not allowed');
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.resolve(ROOT, '.' + pathname);

  if (!filePath.startsWith(ROOT + path.sep)){
    return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden');
  }

  try {
    const body = await fs.readFile(filePath);
    const headers = {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    };
    send(res, 200, headers, req.method === 'HEAD' ? '' : body);
  } catch {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
  }
}

async function start(){
  await loadEnvFiles();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === PROXY_PATH) return void handleProxy(req, res);
    return void handleStatic(req, res);
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Local app + agent proxy: http://127.0.0.1:${PORT}`);
    console.log(`Proxy endpoint: http://127.0.0.1:${PORT}${PROXY_PATH}`);
  });
}

start().catch(error => {
  console.error('Failed to start local proxy:', error.message || error);
  process.exit(1);
});
