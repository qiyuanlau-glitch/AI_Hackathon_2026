/**
 * Cloudflare Pages Function for the /agent-proxy route.
 *
 * lessen-hoa.pages.dev is a Cloudflare Pages project (deployed via deploy.sh).
 * Pages does NOT run worker.js (that's the Workers Builds entry); it only runs
 * server code from this functions/ directory. This file mirrors worker.js and
 * agent-proxy-core.cjs so /agent-proxy behaves identically everywhere.
 *
 * Stateless CORS proxy: forwards a OneBrain agent call to meshstage.smsassist.com
 * (which sends no CORS headers, so the browser can't call it directly). No secrets
 * live here — the agent token arrives in the request body from the client config.
 */

const ALLOWED_AGENT_HOSTS = new Set(['meshstage.smsassist.com']);
const MAX_BODY_BYTES = 1024 * 1024;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  };
}

function normalizeToken(token) {
  return String(token || '').trim().replace(/^Bearer\s+/i, '').trim();
}

function parseJson(text) {
  try {
    return { data: text ? JSON.parse(text) : null, jsonError: null };
  } catch (error) {
    return { data: null, jsonError: error.message };
  }
}

function validateAgentUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch {
    const error = new Error('Agent endpoint URL is invalid.');
    error.statusCode = 400;
    throw error;
  }

  if (url.protocol !== 'https:' || !ALLOWED_AGENT_HOSTS.has(url.hostname)) {
    const error = new Error('Agent endpoint host is not allowed.');
    error.statusCode = 400;
    throw error;
  }

  if (!url.pathname.startsWith('/onebrain/conversation/')) {
    const error = new Error('Agent endpoint path is not allowed.');
    error.statusCode = 400;
    throw error;
  }

  return url.toString();
}

// The OneBrain message has a hard 64,000-char limit on `text`, so large blobs
// (e.g. the knowledge base) must travel as `files[]` siblings rather than being
// inlined into the serialized message. Pull any `files` out of the payload and
// forward them alongside the (now small) JSON text.
function buildOneBrainBody(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const { files, ...rest } = source;
  const body = { text: JSON.stringify(rest) };
  if (Array.isArray(files) && files.length) body.files = files;
  return body;
}

async function forwardAgentRequest(input) {
  const source = input && typeof input === 'object' ? input : {};
  const targetUrl = validateAgentUrl(source.url);
  const token = normalizeToken(source.token);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = 'Bearer ' + token;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildOneBrainBody(source.payload)),
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const parsed = parseJson(text);

  return {
    proxy: true,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    contentType,
    data: parsed.data,
    text,
    jsonError: parsed.jsonError,
  };
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const headers = corsHeaders();
  try {
    const raw = await context.request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ proxy: true, ok: false, status: 413, error: 'Request body is too large.' }),
        { status: 413, headers }
      );
    }
    const input = raw ? JSON.parse(raw) : {};
    const result = await forwardAgentRequest(input);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    const status = error.statusCode || 502;
    return new Response(
      JSON.stringify({
        proxy: true,
        ok: false,
        status,
        statusText: 'Proxy Error',
        error: error.message || String(error),
      }),
      { status, headers }
    );
  }
}

export async function onRequest() {
  return new Response(
    JSON.stringify({ proxy: true, ok: false, error: 'Method not allowed.' }),
    { status: 405, headers: corsHeaders() }
  );
}
