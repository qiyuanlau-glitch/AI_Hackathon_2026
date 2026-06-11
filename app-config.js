(function(){
  const STORAGE_KEY = 'lessen.agentConfig.v1';
  const LOCAL_PROXY_PORT_KEY = 'lessen.agentProxyPort';
  const REMOTE_PROXY_URL_KEY = 'lessen.agentProxyUrl';
  const PROXY_PATH = '/agent-proxy';
  const LOCAL_PROXY_PORT = '8787';
  // Where the agent proxy lives when the app is served from a static host (e.g.
  // GitHub Pages) that can't run server-side code. Paste your deployed
  // Cloudflare Worker URL here, or override per-browser via the
  // 'lessen.agentProxyUrl' localStorage key. The proxy is the stateless CORS
  // shim in cloudflare/agent-proxy-worker.js.
  const REMOTE_AGENT_PROXY_URL = '';
  const DEFAULT_AGENT_ID = 'onebrain-stage-sample';
  const VIOLATION_AGENT_ID = 'onebrain-violation';
  const GUIDELINE_AGENT_ID = 'onebrain-guideline';
  const STAGE_DEFINITIONS = [
    {
      id: 'tenantSummary',
      name: 'Responsibility agent',
      description: 'Runs after the tenant submits the report — determines tenant/landlord responsibility and routing. Input/output mapping is hardcoded in tenant-flow.html.',
    },
    {
      id: 'pipelineParse',
      name: 'Pipeline: parse intent',
      description: 'Reserved for the parse-intent step in the behind-the-scenes flow.',
    },
    {
      id: 'pipelineResponsibility',
      name: 'Pipeline: responsibility check',
      description: 'Reserved for lease/document responsibility reasoning.',
    },
    {
      id: 'pipelineRouting',
      name: 'Pipeline: work routing',
      description: 'Reserved for vendor ranking and work-order routing.',
    },
    {
      id: 'violationCheck',
      name: 'Violation agent',
      description: 'Internal flow: assesses the work order + knowledge base for lease/guideline violations. Returns violations[] with recommended actions.',
    },
    {
      id: 'guidelineCheck',
      name: 'Guideline agent',
      description: 'Internal flow only: re-assesses a work order against the knowledge base / community guidelines. Returns the guideline view.',
    },
  ];
  const DEFAULT_STAGE_AGENTS = Object.fromEntries(
    STAGE_DEFINITIONS.map(stage => [stage.id, DEFAULT_AGENT_ID])
  );
  // Pre-assign the two internal-flow stages to their dedicated agents.
  DEFAULT_STAGE_AGENTS.violationCheck = VIOLATION_AGENT_ID;
  DEFAULT_STAGE_AGENTS.guidelineCheck = GUIDELINE_AGENT_ID;

  const DEFAULT_CONFIG = {
    liveAgentEnabled: false,
    activeAgentId: DEFAULT_AGENT_ID,
    stageAgents: { ...DEFAULT_STAGE_AGENTS },
    agents: [
      {
        id: DEFAULT_AGENT_ID,
        name: "OneBrain stage sample",
        url: "https://meshstage.smsassist.com/onebrain/conversation/b22c62e4-40e5-4167-8a2f-97ff60517c98/bc42bf2f-7f0a-4edf-9c5d-ed0b35b36aac",
        method: "POST",
        token: "",
      },
      {
        id: VIOLATION_AGENT_ID,
        name: "Violation agent",
        url: "https://meshstage.smsassist.com/onebrain/conversation/eacdbdde-e6f9-4eec-8434-5a23a19f813b/ff9c654d-1052-4b1e-b1db-1e4a92920ba8",
        method: "POST",
        token: "",
      },
      {
        id: GUIDELINE_AGENT_ID,
        name: "Guideline agent",
        url: "https://meshstage.smsassist.com/onebrain/conversation/f4a8dbce-c271-4f16-a32d-5a2eda35b7e6/b95c94f4-9b69-4042-a619-2c07139784e6",
        method: "POST",
        token: "",
      },
    ],
  };

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function createId(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'agent-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeMethod(){
    return 'POST';
  }

  function normalizeToken(token){
    return String(token || '').trim().replace(/^Bearer\s+/i, '').trim();
  }

  function normalizeAgent(agent){
    const id = String(agent && agent.id || '').trim() || createId();
    return {
      id,
      name: String(agent && agent.name || 'Untitled agent').trim() || 'Untitled agent',
      url: String(agent && agent.url || '').trim(),
      method: normalizeMethod(),
      token: normalizeToken(agent && agent.token),
    };
  }

  function normalizeConfig(input){
    const source = input && typeof input === 'object' ? input : {};
    const agents = Array.isArray(source.agents)
      ? source.agents.map(normalizeAgent)
      : [];

    if (!agents.length) agents.push(clone(DEFAULT_CONFIG.agents[0]));

    // Always make the pre-seeded default agents available (merge in any that an
    // older stored config predates), preserving the user's token if they already
    // have one for that id.
    DEFAULT_CONFIG.agents.forEach(defaultAgent => {
      if (!agents.some(agent => agent.id === defaultAgent.id)){
        agents.push(clone(defaultAgent));
      }
    });

    const activeAgentId = agents.some(agent => agent.id === source.activeAgentId)
      ? source.activeAgentId
      : agents[0].id;

    const stageAgents = {};
    const sourceStageAgents = source.stageAgents && typeof source.stageAgents === 'object'
      ? source.stageAgents
      : {};
    STAGE_DEFINITIONS.forEach(stage=>{
      // Prefer the stored assignment; otherwise fall back to the stage's default
      // (so violationCheck/guidelineCheck land on their dedicated agents), then active.
      const stored = sourceStageAgents[stage.id];
      const fallback = DEFAULT_STAGE_AGENTS[stage.id];
      stageAgents[stage.id] = agents.some(agent => agent.id === stored)
        ? stored
        : (agents.some(agent => agent.id === fallback) ? fallback : activeAgentId);
    });

    return {
      liveAgentEnabled: Boolean(source.liveAgentEnabled),
      activeAgentId,
      stageAgents,
      agents,
    };
  }

  function loadConfig(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_CONFIG);
      return normalizeConfig(JSON.parse(raw));
    } catch {
      return clone(DEFAULT_CONFIG);
    }
  }

  function saveConfig(config){
    const next = normalizeConfig(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('lessen-agent-config-change', { detail: next }));
    return next;
  }

  function getActiveAgent(config){
    const cfg = normalizeConfig(config || loadConfig());
    return cfg.agents.find(agent => agent.id === cfg.activeAgentId) || cfg.agents[0] || null;
  }

  function getStageAgent(stageId, config){
    const cfg = normalizeConfig(config || loadConfig());
    const agentId = cfg.stageAgents[stageId] || cfg.activeAgentId;
    return cfg.agents.find(agent => agent.id === agentId) || getActiveAgent(cfg);
  }

  function getAuthHeader(agent){
    const token = normalizeToken(agent && agent.token);
    return token ? 'Bearer ' + token : '';
  }

  function getRemoteProxyUrl(){
    const stored = (localStorage.getItem(REMOTE_PROXY_URL_KEY) || '').trim();
    return (stored || REMOTE_AGENT_PROXY_URL || '').trim();
  }

  function isLocalHost(){
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  }

  function getProxyUrl(){
    // Opened straight off disk: talk to the local proxy on 127.0.0.1.
    if (window.location.protocol === 'file:'){
      const port = localStorage.getItem(LOCAL_PROXY_PORT_KEY) || LOCAL_PROXY_PORT;
      return `http://127.0.0.1:${port}${PROXY_PATH}`;
    }
    // Served by the local proxy itself (node local-agent-proxy.cjs): same origin.
    if (isLocalHost()) return PROXY_PATH;
    // Any other origin (e.g. GitHub Pages) is a static host with no server, so
    // use the externally deployed Cloudflare Worker.
    return getRemoteProxyUrl();
  }

  function buildProxyFetchOptions(agent, payload){
    return {
      method: normalizeMethod(),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: agent.url,
        token: agent.token,
        payload: payload || {},
      }),
    };
  }

  async function requestAgent(agent, payload){
    const normalized = normalizeAgent(agent);
    if (!normalized.url) throw new Error('Agent endpoint URL is required.');

    const proxyUrl = getProxyUrl();
    if (!proxyUrl){
      throw new Error('No agent proxy is configured for this host. Deploy cloudflare/agent-proxy-worker.js and set its URL via REMOTE_AGENT_PROXY_URL in app-config.js or the "lessen.agentProxyUrl" localStorage key.');
    }
    let response;
    try {
      response = await fetch(proxyUrl, buildProxyFetchOptions(normalized, payload));
    } catch (error) {
      const hint = window.location.protocol === 'file:'
        ? `Run "node local-agent-proxy.cjs" and keep this page open, or open http://127.0.0.1:${localStorage.getItem(LOCAL_PROXY_PORT_KEY) || LOCAL_PROXY_PORT}/.`
        : 'Check the Cloudflare Worker is deployed and its URL is set, or run the local proxy/dev server.';
      throw new Error(`Agent proxy is unreachable at ${proxyUrl}. ${hint} ${error.message || error}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let data = null;
    let jsonError = null;

    if (text){
      try {
        data = JSON.parse(text);
      } catch (error) {
        jsonError = error.message;
      }
    }

    const proxyResult = data && typeof data === 'object' && data.proxy
      ? data
      : null;

    return {
      ok: proxyResult ? Boolean(proxyResult.ok) : response.ok,
      status: proxyResult ? proxyResult.status : response.status,
      statusText: proxyResult ? proxyResult.statusText : response.statusText,
      contentType: proxyResult ? proxyResult.contentType : contentType,
      data: proxyResult ? proxyResult.data : data,
      text: proxyResult ? proxyResult.text : text,
      jsonError: proxyResult ? proxyResult.jsonError : jsonError,
      proxyError: proxyResult ? proxyResult.error : null,
      agent: {
        id: normalized.id,
        name: normalized.name,
        url: normalized.url,
        method: normalized.method,
        proxyUrl,
      },
    };
  }

  async function callActiveAgent(payload){
    const config = loadConfig();
    if (!config.liveAgentEnabled) throw new Error('Live agent calls are disabled in config.');
    const agent = getActiveAgent(config);
    if (!agent) throw new Error('No active agent is configured.');
    return requestAgent(agent, payload);
  }

  async function callStageAgent(stageId, payload){
    const config = loadConfig();
    if (!config.liveAgentEnabled) throw new Error('Live agent calls are disabled in config.');
    const agent = getStageAgent(stageId, config);
    if (!agent) throw new Error(`No agent is configured for stage: ${stageId}`);
    return requestAgent(agent, payload);
  }

  window.LessenAgentConfig = {
    STORAGE_KEY,
    LOCAL_PROXY_PORT_KEY,
    REMOTE_PROXY_URL_KEY,
    PROXY_PATH,
    STAGE_DEFINITIONS,
    DEFAULT_CONFIG,
    createId,
    normalizeToken,
    normalizeAgent,
    normalizeConfig,
    loadConfig,
    saveConfig,
    getActiveAgent,
    getStageAgent,
    getProxyUrl,
    getRemoteProxyUrl,
    requestAgent,
    callActiveAgent,
    callStageAgent,
  };
})();
