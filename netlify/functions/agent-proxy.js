const { corsHeaders, forwardAgentRequest } = require('../../agent-proxy-core.cjs');

exports.handler = async function handler(event){
  const headers = {
    ...corsHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS'){
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST'){
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ proxy: true, ok: false, error: 'Method not allowed.' }),
    };
  }

  try {
    const input = event.body ? JSON.parse(event.body) : {};
    const result = await forwardAgentRequest(input);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    return {
      statusCode: error.statusCode || 502,
      headers,
      body: JSON.stringify({
        proxy: true,
        ok: false,
        status: error.statusCode || 502,
        statusText: 'Proxy Error',
        error: error.message || String(error),
      }),
    };
  }
};
