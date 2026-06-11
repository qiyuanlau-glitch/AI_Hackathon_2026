(function(){
  const STORAGE_KEY = 'lessen.agentConfig.v1';
  const LOCAL_PROXY_PORT_KEY = 'lessen.agentProxyPort';
  const PROXY_PATH = '/.netlify/functions/agent-proxy';
  const LOCAL_PROXY_PORT = '8787';
  const DEFAULT_AGENT_ID = 'onebrain-stage-sample';
  const STAGE_DEFINITIONS = [
    {
      id: 'tenantSummary',
      name: 'Tenant flow: summary + routing',
      description: 'Runs after the tenant submits the report. Input/output mapping is hardcoded in tenant-flow.html.',
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
      id: 'guidelineCheck',
      name: 'Guideline / knowledge-base check',
      description: 'Re-assesses a work order against community guidelines (e.g. after a communication). Mocked in tenant-flow.html until wired.',
    },
  ];
  const DEFAULT_STAGE_AGENTS = Object.fromEntries(
    STAGE_DEFINITIONS.map(stage => [stage.id, DEFAULT_AGENT_ID])
  );
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

    const activeAgentId = agents.some(agent => agent.id === source.activeAgentId)
      ? source.activeAgentId
      : agents[0].id;

    const stageAgents = {};
    const sourceStageAgents = source.stageAgents && typeof source.stageAgents === 'object'
      ? source.stageAgents
      : {};
    STAGE_DEFINITIONS.forEach(stage=>{
      stageAgents[stage.id] = agents.some(agent => agent.id === sourceStageAgents[stage.id])
        ? sourceStageAgents[stage.id]
        : activeAgentId;
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

  function getProxyUrl(){
    if (window.location.protocol === 'file:'){
      const port = localStorage.getItem(LOCAL_PROXY_PORT_KEY) || LOCAL_PROXY_PORT;
      return `http://127.0.0.1:${port}${PROXY_PATH}`;
    }
    return PROXY_PATH;
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
    let response;
    try {
      response = await fetch(proxyUrl, buildProxyFetchOptions(normalized, payload));
    } catch (error) {
      const hint = window.location.protocol === 'file:'
        ? `Run "node local-agent-proxy.cjs" and keep this page open, or open http://127.0.0.1:${localStorage.getItem(LOCAL_PROXY_PORT_KEY) || LOCAL_PROXY_PORT}/.`
        : 'Deploy with Netlify Functions enabled, or run the local proxy/dev server.';
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
    requestAgent,
    callActiveAgent,
    callStageAgent,
  };
})();
