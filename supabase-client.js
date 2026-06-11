(function(){
  const STORAGE_KEY = 'lessen.supabaseConfig.v1';
  const DEFAULT_TABLES = {
    workOrders: 'work_orders',
    messages: 'work_order_messages',
  };

  function clean(value){
    return String(value || '').trim();
  }

  function trimTrailingSlash(value){
    return clean(value).replace(/\/+$/, '');
  }

  function normalizeTables(input){
    const source = input && typeof input === 'object' ? input : {};
    return {
      workOrders: clean(source.workOrders) || DEFAULT_TABLES.workOrders,
      messages: clean(source.messages) || DEFAULT_TABLES.messages,
    };
  }

  function normalizeConfig(input){
    const source = input && typeof input === 'object' ? input : {};
    return {
      url: trimTrailingSlash(source.url),
      key: clean(source.key),
      tables: normalizeTables(source.tables),
    };
  }

  function readStoredConfig(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function loadConfig(){
    return normalizeConfig({
      ...(window.LessenSupabaseConfig || {}),
      ...(readStoredConfig() || {}),
      tables: {
        ...DEFAULT_TABLES,
        ...((window.LessenSupabaseConfig || {}).tables || {}),
        ...((readStoredConfig() || {}).tables || {}),
      },
    });
  }

  function saveConfig(config){
    const next = normalizeConfig(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('lessen-supabase-config-change', { detail: next }));
    return next;
  }

  function clearConfig(){
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('lessen-supabase-config-change'));
  }

  function isConfigured(config){
    const cfg = normalizeConfig(config || loadConfig());
    return Boolean(cfg.url && cfg.key);
  }

  function assertConfig(){
    const cfg = loadConfig();
    if (!cfg.url || !cfg.key){
      throw new Error('Supabase is not configured. Add the project URL and publishable/anon key in supabase-config.js.');
    }
    if (/^sb_secret_/i.test(cfg.key)){
      throw new Error('Supabase secret keys must never be used in the browser. Use the publishable key or legacy anon key.');
    }
    return cfg;
  }

  function isJwtKey(key){
    return /^eyJ/.test(key) && key.split('.').length === 3;
  }

  function headersFor(cfg, extraHeaders){
    const headers = {
      apikey: cfg.key,
      Accept: 'application/json',
      ...(extraHeaders || {}),
    };
    if (isJwtKey(cfg.key)) headers.Authorization = `Bearer ${cfg.key}`;
    return headers;
  }

  function tableUrl(cfg, table, query){
    const suffix = query ? `?${query}` : '';
    return `${cfg.url}/rest/v1/${encodeURIComponent(table)}${suffix}`;
  }

  function filterValue(value){
    return encodeURIComponent(clean(value));
  }

  async function parseResponse(response){
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function request(table, query, options){
    const cfg = assertConfig();
    const opts = options || {};
    const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const response = await fetch(tableUrl(cfg, table, query), {
      method: opts.method || 'GET',
      headers: headersFor(cfg, {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      }),
      body,
    });
    const data = await parseResponse(response);
    if (!response.ok){
      const message = data && typeof data === 'object'
        ? (data.message || data.error_description || data.error || JSON.stringify(data))
        : (data || `HTTP ${response.status}`);
      throw new Error(`Supabase ${response.status}: ${message}`);
    }
    return data;
  }

  function requiredString(value, field){
    const next = clean(value);
    if (!next) throw new Error(`"${field}" is required.`);
    return next;
  }

  function optionalString(value){
    const next = clean(value);
    return next || null;
  }

  function uploadsJson(value){
    return Array.isArray(value)
      ? value.map(item => ({
          uploadId: clean(item && item.uploadId),
          fileName: clean(item && item.fileName),
          filePath: clean(item && item.filePath),
        })).filter(item => item.uploadId && item.fileName && item.filePath)
      : [];
  }

  function toWorkOrderRow(payload){
    return {
      work_order_id: requiredString(payload.workOrderId, 'workOrderId'),
      desc: optionalString(payload.desc),
      unit: optionalString(payload.unit),
      service_category_name: requiredString(payload.serviceCategoryName, 'serviceCategoryName'),
      service_problem_name: requiredString(payload.serviceProblemName, 'serviceProblemName'),
      service_code_name: requiredString(payload.serviceCodeName, 'serviceCodeName'),
      location_address: requiredString(payload.locationAddress, 'locationAddress'),
      inspection: Boolean(payload.inspection),
      uploads: uploadsJson(payload.uploads),
      status: clean(payload.status) || 'DISPATCHED',
      created_at: clean(payload.createdAt) || new Date().toISOString(),
    };
  }

  function toMessageRow(workOrderId, payload){
    return {
      work_order_id: requiredString(workOrderId, 'workOrderId'),
      created_at: clean(payload.createdAt) || new Date().toISOString(),
      sender: requiredString(payload.from, 'from'),
      recipient: requiredString(payload.to, 'to'),
      message: requiredString(payload.message, 'message'),
    };
  }

  function fromMessageRow(row){
    return {
      createdAt: row.created_at,
      from: row.sender,
      to: row.recipient,
      message: row.message,
    };
  }

  function fromWorkOrderRow(row, messagesByOrderId){
    const workOrderId = row.work_order_id || row.id || '';
    const messages = messagesByOrderId && messagesByOrderId.get(workOrderId) || [];
    return {
      id: row.id || null,
      workOrderId,
      desc: row.desc || '',
      unit: row.unit || '',
      serviceCategoryName: row.service_category_name || '',
      serviceProblemName: row.service_problem_name || '',
      serviceCodeName: row.service_code_name || '',
      locationAddress: row.location_address || '',
      inspection: Boolean(row.inspection),
      status: row.status || 'DISPATCHED',
      uploads: Array.isArray(row.uploads) ? row.uploads : [],
      createdAt: row.created_at,
      submittedAt: row.created_at,
      insertedAt: row.inserted_at || row.created_at,
      updatedAt: row.updated_at || null,
      guideline: row.guideline || null,
      communications: messages.map(fromMessageRow),
    };
  }

  function buildMessagesMap(rows){
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const workOrderId = row.work_order_id;
      if (!workOrderId) return;
      if (!map.has(workOrderId)) map.set(workOrderId, []);
      map.get(workOrderId).push(row);
    });
    return map;
  }

  async function createWorkOrder(payload){
    const cfg = assertConfig();
    const rows = await request(cfg.tables.workOrders, 'select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: toWorkOrderRow(payload),
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      ok: true,
      id: row && row.id || null,
      collection: cfg.tables.workOrders,
      workOrderId: row && row.work_order_id || payload.workOrderId,
    };
  }

  async function fetchWorkOrders(){
    const cfg = assertConfig();
    const [orders, messages] = await Promise.all([
      request(cfg.tables.workOrders, 'select=*&order=inserted_at.desc,created_at.desc&limit=50'),
      request(cfg.tables.messages, 'select=*&order=created_at.asc'),
    ]);
    const messagesByOrderId = buildMessagesMap(messages);
    return (Array.isArray(orders) ? orders : []).map(row => fromWorkOrderRow(row, messagesByOrderId));
  }

  async function addWorkOrderMessage(workOrderId, payload){
    const cfg = assertConfig();
    await request(cfg.tables.messages, 'select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: toMessageRow(workOrderId, payload),
    });
    await request(cfg.tables.workOrders, `work_order_id=eq.${filterValue(workOrderId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { updated_at: new Date().toISOString() },
    });
    return { ok: true, workOrderId, updated: true };
  }

  async function updateWorkOrder(payload){
    const cfg = assertConfig();
    const workOrderId = requiredString(payload.workOrderId, 'workOrderId');
    const updateFields = {
      desc: requiredString(payload.desc, 'desc'),
      service_category_name: requiredString(payload.serviceCategoryName, 'serviceCategoryName'),
      service_problem_name: requiredString(payload.serviceProblemName, 'serviceProblemName'),
      service_code_name: requiredString(payload.serviceCodeName, 'serviceCodeName'),
      unit: requiredString(payload.unit, 'unit'),
      location_address: requiredString(payload.locationAddress, 'locationAddress'),
      inspection: Boolean(payload.inspection),
      updated_at: new Date().toISOString(),
    };
    if (Array.isArray(payload.uploads)) updateFields.uploads = uploadsJson(payload.uploads);

    const rows = await request(cfg.tables.workOrders, `work_order_id=eq.${filterValue(workOrderId)}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: updateFields,
    });
    if (!Array.isArray(rows) || !rows.length){
      throw new Error(`Work order not found: ${workOrderId}`);
    }
    return { ok: true, workOrderId, updated: true };
  }

  window.LessenSupabase = {
    STORAGE_KEY,
    DEFAULT_TABLES,
    loadConfig,
    saveConfig,
    clearConfig,
    isConfigured,
    createWorkOrder,
    fetchWorkOrders,
    addWorkOrderMessage,
    updateWorkOrder,
  };
})();
