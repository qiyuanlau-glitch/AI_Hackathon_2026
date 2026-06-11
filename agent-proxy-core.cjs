const ALLOWED_AGENT_HOSTS = new Set(['meshstage.smsassist.com']);
const MAX_BODY_BYTES = 1024 * 1024;

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function normalizeToken(token){
  return String(token || '').trim().replace(/^Bearer\s+/i, '').trim();
}

function parseJson(text){
  try {
    return { data: text ? JSON.parse(text) : null, jsonError: null };
  } catch (error) {
    return { data: null, jsonError: error.message };
  }
}

function validateAgentUrl(rawUrl){
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch {
    const error = new Error('Agent endpoint URL is invalid.');
    error.statusCode = 400;
    throw error;
  }

  if (url.protocol !== 'https:' || !ALLOWED_AGENT_HOSTS.has(url.hostname)){
    const error = new Error('Agent endpoint host is not allowed.');
    error.statusCode = 400;
    throw error;
  }

  if (!url.pathname.startsWith('/onebrain/conversation/')){
    const error = new Error('Agent endpoint path is not allowed.');
    error.statusCode = 400;
    throw error;
  }

  return url.toString();
}

function buildOneBrainBody(payload){
  return {
    text: JSON.stringify(payload || {}),
  };
}

async function forwardAgentRequest(input){
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

async function readRequestBody(stream){
  const chunks = [];
  let size = 0;
  for await (const chunk of stream){
    size += chunk.length;
    if (size > MAX_BODY_BYTES){
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  MAX_BODY_BYTES,
  corsHeaders,
  buildOneBrainBody,
  forwardAgentRequest,
  readRequestBody,
};
