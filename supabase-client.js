(function () {
  const STORAGE_KEY = "lessen.supabaseConfig.v1";
  const DEFAULT_TABLES = {
    workOrders: "work_orders",
    messages: "work_order_messages",
  };

  function clean(value) {
    return String(value || "").trim();
  }

  function trimTrailingSlash(value) {
    return clean(value).replace(/\/+$/, "");
  }

  function normalizeTables(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      workOrders: clean(source.workOrders) || DEFAULT_TABLES.workOrders,
      messages: clean(source.messages) || DEFAULT_TABLES.messages,
    };
  }

  function normalizeConfig(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      url: trimTrailingSlash(source.url),
      key: clean(source.key),
      tables: normalizeTables(source.tables),
    };
  }

  function readStoredConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function loadConfig() {
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

  function saveConfig(config) {
    const next = normalizeConfig(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent("lessen-supabase-config-change", { detail: next }),
    );
    return next;
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("lessen-supabase-config-change"));
  }

  function isConfigured(config) {
    const cfg = normalizeConfig(config || loadConfig());
    return Boolean(cfg.url && cfg.key);
  }

  function assertConfig() {
    const cfg = loadConfig();
    if (!cfg.url || !cfg.key) {
      throw new Error(
        "Supabase is not configured. Add the project URL and publishable/anon key in supabase-config.js.",
      );
    }
    if (/^sb_secret_/i.test(cfg.key)) {
      throw new Error(
        "Supabase secret keys must never be used in the browser. Use the publishable key or legacy anon key.",
      );
    }
    return cfg;
  }

  function isJwtKey(key) {
    return /^eyJ/.test(key) && key.split(".").length === 3;
  }

  function headersFor(cfg, extraHeaders) {
    const headers = {
      apikey: cfg.key,
      Accept: "application/json",
      ...(extraHeaders || {}),
    };
    if (isJwtKey(cfg.key)) headers.Authorization = `Bearer ${cfg.key}`;
    return headers;
  }

  function tableUrl(cfg, table, query) {
    const suffix = query ? `?${query}` : "";
    return `${cfg.url}/rest/v1/${encodeURIComponent(table)}${suffix}`;
  }

  function filterValue(value) {
    return encodeURIComponent(clean(value));
  }

  async function parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function request(table, query, options) {
    const cfg = assertConfig();
    const opts = options || {};
    const body =
      opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const response = await fetch(tableUrl(cfg, table, query), {
      method: opts.method || "GET",
      headers: headersFor(cfg, {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(opts.headers || {}),
      }),
      body,
    });
    const data = await parseResponse(response);
    if (!response.ok) {
      const message =
        data && typeof data === "object"
          ? data.message ||
            data.error_description ||
            data.error ||
            JSON.stringify(data)
          : data || `HTTP ${response.status}`;
      throw new Error(`Supabase ${response.status}: ${message}`);
    }
    return data;
  }

  function requiredString(value, field) {
    const next = clean(value);
    if (!next) throw new Error(`"${field}" is required.`);
    return next;
  }

  function optionalString(value) {
    const next = clean(value);
    return next || null;
  }

  function uploadsJson(value) {
    return Array.isArray(value)
      ? value
          .map((item) => ({
            uploadId: clean(item && item.uploadId),
            fileName: clean(item && item.fileName),
            filePath: clean(item && item.filePath),
          }))
          .filter((item) => item.uploadId && item.fileName && item.filePath)
      : [];
  }

  function toWorkOrderRow(payload) {
    return {
      work_order_id: requiredString(payload.workOrderId, "workOrderId"),
      desc: optionalString(payload.desc),
      unit: optionalString(payload.unit),
      service_category_name: requiredString(
        payload.serviceCategoryName,
        "serviceCategoryName",
      ),
      service_problem_name: requiredString(
        payload.serviceProblemName,
        "serviceProblemName",
      ),
      service_code_name: requiredString(
        payload.serviceCodeName,
        "serviceCodeName",
      ),
      location_address: requiredString(
        payload.locationAddress,
        "locationAddress",
      ),
      inspection: Boolean(payload.inspection),
      uploads: uploadsJson(payload.uploads),
      status: clean(payload.status) || "DISPATCHED",
      created_at: clean(payload.createdAt) || new Date().toISOString(),
    };
  }

  function toMessageRow(workOrderId, payload) {
    return {
      work_order_id: requiredString(workOrderId, "workOrderId"),
      created_at: clean(payload.createdAt) || new Date().toISOString(),
      sender: requiredString(payload.from, "from"),
      recipient: requiredString(payload.to, "to"),
      message: requiredString(payload.message, "message"),
    };
  }

  function fromMessageRow(row) {
    return {
      createdAt: row.created_at,
      from: row.sender,
      to: row.recipient,
      message: row.message,
    };
  }

  function fromWorkOrderRow(row, messagesByOrderId) {
    const workOrderId = row.work_order_id || row.id || "";
    const messages =
      (messagesByOrderId && messagesByOrderId.get(workOrderId)) || [];
    return {
      id: row.id || null,
      workOrderId,
      desc: row.desc || "",
      unit: row.unit || "",
      serviceCategoryName: row.service_category_name || "",
      serviceProblemName: row.service_problem_name || "",
      serviceCodeName: row.service_code_name || "",
      locationAddress: row.location_address || "",
      inspection: Boolean(row.inspection),
      status: row.status || "DISPATCHED",
      uploads: Array.isArray(row.uploads) ? row.uploads : [],
      createdAt: row.created_at,
      submittedAt: row.created_at,
      insertedAt: row.inserted_at || row.created_at,
      updatedAt: row.updated_at || null,
      guideline: row.guideline || null,
      responsibility: row.responsibility || null,
      communications: messages.map(fromMessageRow),
    };
  }

  function buildMessagesMap(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const workOrderId = row.work_order_id;
      if (!workOrderId) return;
      if (!map.has(workOrderId)) map.set(workOrderId, []);
      map.get(workOrderId).push(row);
    });
    return map;
  }

  async function createWorkOrder(payload) {
    const cfg = assertConfig();
    const rows = await request(cfg.tables.workOrders, "select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: toWorkOrderRow(payload),
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      ok: true,
      id: (row && row.id) || null,
      collection: cfg.tables.workOrders,
      workOrderId: (row && row.work_order_id) || payload.workOrderId,
    };
  }

  async function fetchWorkOrders() {
    const cfg = assertConfig();
    const [orders, messages] = await Promise.all([
      request(
        cfg.tables.workOrders,
        "select=*&order=inserted_at.desc,created_at.desc&limit=50",
      ),
      request(cfg.tables.messages, "select=*&order=created_at.asc"),
    ]);
    const messagesByOrderId = buildMessagesMap(messages);
    return (Array.isArray(orders) ? orders : []).map((row) =>
      fromWorkOrderRow(row, messagesByOrderId),
    );
  }

  // Compute the next sequential work order id (WO-<year>-NNN) from the max
  // existing suffix for the year, +1. Prevents random-id collisions when a
  // submit hangs after the row was created and the user presses create again.
  async function nextWorkOrderId(year) {
    const cfg = assertConfig();
    const yr = year || new Date().getFullYear();
    const pattern = encodeURIComponent(`WO-${yr}-*`);
    const rows = await request(
      cfg.tables.workOrders,
      `work_order_id=like.${pattern}&select=work_order_id&limit=1000`,
    );
    let max = 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const match = /-(\d+)\s*$/.exec((row && row.work_order_id) || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `WO-${yr}-${String(max + 1).padStart(3, "0")}`;
  }

  async function addWorkOrderMessage(workOrderId, payload) {
    const cfg = assertConfig();
    await request(cfg.tables.messages, "select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: toMessageRow(workOrderId, payload),
    });
    await request(
      cfg.tables.workOrders,
      `work_order_id=eq.${filterValue(workOrderId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: { updated_at: new Date().toISOString() },
      },
    );
    return { ok: true, workOrderId, updated: true };
  }

  async function updateWorkOrder(payload) {
    const cfg = assertConfig();
    const workOrderId = requiredString(payload.workOrderId, "workOrderId");
    const updateFields = {
      desc: requiredString(payload.desc, "desc"),
      service_category_name: requiredString(
        payload.serviceCategoryName,
        "serviceCategoryName",
      ),
      service_problem_name: requiredString(
        payload.serviceProblemName,
        "serviceProblemName",
      ),
      service_code_name: requiredString(
        payload.serviceCodeName,
        "serviceCodeName",
      ),
      unit: requiredString(payload.unit, "unit"),
      location_address: requiredString(
        payload.locationAddress,
        "locationAddress",
      ),
      inspection: Boolean(payload.inspection),
      updated_at: new Date().toISOString(),
    };
    const status = clean(payload.status);
    if (status) updateFields.status = status;
    if (Array.isArray(payload.uploads))
      updateFields.uploads = uploadsJson(payload.uploads);

    const rows = await request(
      cfg.tables.workOrders,
      `work_order_id=eq.${filterValue(workOrderId)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: updateFields,
      },
    );
    if (!Array.isArray(rows) || !rows.length) {
      throw new Error(`Work order not found: ${workOrderId}`);
    }
    return { ok: true, workOrderId, updated: true };
  }

  // Persist the violation/guideline agent result onto an existing work order so
  // the internal detail view can reuse it instead of re-running the agents.
  // Lightweight on purpose: only touches the `guideline` jsonb column.
  async function updateWorkOrderGuideline(workOrderId, guideline) {
    const cfg = assertConfig();
    const id = requiredString(workOrderId, "workOrderId");
    await request(
      cfg.tables.workOrders,
      `work_order_id=eq.${filterValue(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: {
          guideline: guideline || null,
          updated_at: new Date().toISOString(),
        },
      },
    );
    return { ok: true, workOrderId: id, updated: true };
  }

  // Persist the responsibility agent result (responsibility + combined lease/KB
  // references) onto an existing work order so the internal detail view can show
  // it without re-running the agent. Only touches the `responsibility` jsonb column.
  async function updateWorkOrderResponsibility(workOrderId, responsibility) {
    const cfg = assertConfig();
    const id = requiredString(workOrderId, "workOrderId");
    await request(
      cfg.tables.workOrders,
      `work_order_id=eq.${filterValue(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: {
          responsibility: responsibility || null,
          updated_at: new Date().toISOString(),
        },
      },
    );
    return { ok: true, workOrderId: id, updated: true };
  }

  // ---- File uploads (Supabase Storage, public bucket) -------------------
  // Work-order photos are uploaded here so the violation + guideline agents
  // (and the saved work order) can reference a stable public link instead of a
  // throwaway blob: URL. Defaults to the same "hackathon" bucket as the KB.
  const DEFAULT_BUCKET = "hackathon";

  function storageBucket() {
    const fromStored = (readStoredConfig() || {}).bucket;
    const fromGlobal = (window.LessenSupabaseConfig || {}).bucket;
    return clean(fromStored) || clean(fromGlobal) || DEFAULT_BUCKET;
  }

  function encodeObjectPath(path) {
    return String(path || "")
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
  }

  function publicFileUrl(cfg, bucket, path) {
    return `${cfg.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(path)}`;
  }
  // ---- Knowledge base (Supabase Storage) --------------------------------
  // Single source of truth for the violation + guideline agents. Fetched once,
  // cached, with a fallback to the bundled ./knowledge_base.json so the demo
  // keeps working before the bucket is public / offline.
  let knowledgeBaseCache = null;
  let knowledgeBasePromise = null;

  function knowledgeBaseUrl() {
    const fromStored = (readStoredConfig() || {}).knowledgeBaseUrl;
    const fromGlobal = (window.LessenSupabaseConfig || {}).knowledgeBaseUrl;
    return clean(fromStored) || clean(fromGlobal);
  }

  async function loadKnowledgeBaseFrom(url) {
    if (!url) throw new Error("No knowledge base URL configured.");
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`Knowledge base fetch failed: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data))
      throw new Error("Knowledge base is not an array.");
    return data;
  }

  async function fetchKnowledgeBase(options) {
    const opts = options || {};
    if (opts.forceRefresh) {
      knowledgeBaseCache = null;
      knowledgeBasePromise = null;
    }
    if (Array.isArray(knowledgeBaseCache)) return knowledgeBaseCache;
    if (knowledgeBasePromise) return knowledgeBasePromise;

    knowledgeBasePromise = (async () => {
      // 1) Live Supabase Storage (works once the bucket is public).
      try {
        const data = await loadKnowledgeBaseFrom(knowledgeBaseUrl());
        knowledgeBaseCache = data;
        return data;
      } catch (primaryError) {
        console.warn(
          "[kb] live fetch failed, falling back to bundled copy:",
          primaryError.message || primaryError,
        );
      }
      // 2) Bundled local copy (same-origin / relative to the page).
      try {
        const data = await loadKnowledgeBaseFrom("knowledge_base.json");
        knowledgeBaseCache = data;
        return data;
      } catch (fallbackError) {
        console.error(
          "[kb] bundled fallback failed:",
          fallbackError.message || fallbackError,
        );
        knowledgeBaseCache = [];
        return knowledgeBaseCache;
      }
    })().finally(() => {
      knowledgeBasePromise = null;
    });
    return knowledgeBasePromise;
  }

  async function uploadPublicFile(file, options) {
    const cfg = assertConfig();
    if (!file) throw new Error("No file provided to upload.");
    const opts = options || {};
    const bucket = clean(opts.bucket) || storageBucket();
    const path = requiredString(opts.path, "path");
    const url = `${cfg.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(path)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });
    const data = await parseResponse(response);
    if (!response.ok) {
      const message =
        data && typeof data === "object"
          ? data.message || data.error || JSON.stringify(data)
          : data || `HTTP ${response.status}`;
      throw new Error(`Supabase storage ${response.status}: ${message}`);
    }
    return {
      ok: true,
      bucket,
      path,
      publicUrl: publicFileUrl(cfg, bucket, path),
    };
  }

  // ---- Shared agent config ----------------------------------------------
  // The agent endpoint links + bearer tokens are stored as a single shared row
  // so everyone using the same deployment shares one config, instead of each
  // browser keeping its own copy in localStorage. The browser localStorage copy
  // (see app-config.js) becomes a fast synchronous cache of this row.
  const AGENT_CONFIG_TABLE = "agent_config";
  const AGENT_CONFIG_ID = "shared";

  async function fetchAgentConfig() {
    const rows = await request(
      AGENT_CONFIG_TABLE,
      `id=eq.${filterValue(AGENT_CONFIG_ID)}&select=config`,
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row && row.config ? row.config : null;
  }

  async function saveAgentConfig(config) {
    await request(AGENT_CONFIG_TABLE, "on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: {
        id: AGENT_CONFIG_ID,
        config: config || {},
        updated_at: new Date().toISOString(),
      },
    });
    return { ok: true };
  }

  function toLowerKey(value) {
    return clean(value).toLowerCase();
  }

  function clauseMatchKey(policyName, clause) {
    return [
      toLowerKey(policyName),
      toLowerKey(clause && clause.reference_type),
      toLowerKey(clause && clause.reference_id),
    ].join("::");
  }

  function normalizePolicyEntry(entry) {
    const policyType = clean(entry && entry.policy_type);
    const policyName = clean(entry && entry.policy_name);
    if (!policyName) return null;
    const clauses = Array.isArray(entry && entry.clauses)
      ? entry.clauses
          .map((clause) => ({
            reference_type: clean(clause && clause.reference_type),
            reference_id: clean(clause && clause.reference_id),
            description: clean(clause && clause.description),
          }))
          .filter((clause) => clause.reference_type && clause.reference_id)
      : [];
    if (!clauses.length) return null;
    return {
      policy_type: policyType,
      policy_name: policyName,
      clauses,
    };
  }

  function parsePoliciesFromText(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === "object") {
      if (Array.isArray(value.policies)) return value.policies;
      if (Array.isArray(value.knowledge_base)) return value.knowledge_base;
      if (Array.isArray(value.entries)) return value.entries;
      return [];
    }
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return parsePoliciesFromText(parsed);
    } catch {
      return [];
    }
  }

  function extractPoliciesFromAgentResult(agentResult) {
    const candidates = [
      agentResult && agentResult.data && agentResult.data.text,
      agentResult && agentResult.data && agentResult.data.data,
      agentResult && agentResult.text,
      agentResult,
    ];
    for (const candidate of candidates) {
      const policies = parsePoliciesFromText(candidate);
      if (policies.length) return policies;
    }
    return [];
  }

  function mergeKnowledgeBaseEntries(existing, incoming) {
    const base = Array.isArray(existing)
      ? JSON.parse(JSON.stringify(existing))
      : [];
    const normalizedIncoming = (Array.isArray(incoming) ? incoming : [])
      .map(normalizePolicyEntry)
      .filter(Boolean);
    const existingKeys = new Set();
    base.forEach((policy) => {
      const policyName = policy && policy.policy_name;
      const clauses = Array.isArray(policy && policy.clauses)
        ? policy.clauses
        : [];
      clauses.forEach((clause) => {
        existingKeys.add(clauseMatchKey(policyName, clause));
      });
    });

    let inserted = 0;
    let skipped = 0;

    normalizedIncoming.forEach((incomingPolicy) => {
      const targetPolicy =
        base.find(
          (policy) =>
            toLowerKey(policy && policy.policy_name) ===
            toLowerKey(incomingPolicy.policy_name),
        ) ||
        (() => {
          const created = {
            policy_type: incomingPolicy.policy_type,
            policy_name: incomingPolicy.policy_name,
            clauses: [],
          };
          base.push(created);
          return created;
        })();

      if (!Array.isArray(targetPolicy.clauses)) targetPolicy.clauses = [];
      incomingPolicy.clauses.forEach((clause) => {
        const key = clauseMatchKey(incomingPolicy.policy_name, clause);
        if (existingKeys.has(key)) {
          skipped += 1;
          return;
        }
        existingKeys.add(key);
        targetPolicy.clauses.push(clause);
        inserted += 1;
      });
    });

    return {
      nextKnowledgeBase: base,
      inserted,
      skipped,
      receivedPolicies: normalizedIncoming.length,
    };
  }

  function storageObjectTarget(urlText) {
    const parsed = new URL(urlText);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const tail = parsed.pathname.slice(index + marker.length);
    const slash = tail.indexOf("/");
    if (slash <= 0) return null;
    const bucket = tail.slice(0, slash);
    const objectPath = tail.slice(slash + 1);
    if (!bucket || !objectPath) return null;
    return { bucket, objectPath };
  }

  async function writeKnowledgeBase(nextKnowledgeBase) {
    const cfg = assertConfig();
    const url = knowledgeBaseUrl();
    const target = storageObjectTarget(url);
    if (!target) {
      throw new Error(
        "knowledgeBaseUrl must point to a Supabase public storage object.",
      );
    }
    const objectPath = target.objectPath
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const uploadUrl = `${cfg.url}/storage/v1/object/${encodeURIComponent(target.bucket)}/${objectPath}`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: headersFor(cfg, {
        "Content-Type": "application/json",
        "x-upsert": "true",
      }),
      body: JSON.stringify(nextKnowledgeBase, null, 2),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Knowledge base write failed: HTTP ${response.status}${text ? ` ${text}` : ""}`,
      );
    }
    knowledgeBaseCache = Array.isArray(nextKnowledgeBase)
      ? JSON.parse(JSON.stringify(nextKnowledgeBase))
      : [];
    return { ok: true };
  }

  async function syncKnowledgeBaseFromAgentResult(agentResult) {
    const incomingPolicies = extractPoliciesFromAgentResult(agentResult);
    if (!incomingPolicies.length) {
      return {
        ok: true,
        updated: false,
        receivedPolicies: 0,
        inserted: 0,
        skipped: 0,
      };
    }
    const currentKnowledgeBase = await fetchKnowledgeBase();
    const merged = mergeKnowledgeBaseEntries(
      currentKnowledgeBase,
      incomingPolicies,
    );
    if (!merged.inserted) {
      return {
        ok: true,
        updated: false,
        receivedPolicies: merged.receivedPolicies,
        inserted: 0,
        skipped: merged.skipped,
      };
    }
    await writeKnowledgeBase(merged.nextKnowledgeBase);
    return {
      ok: true,
      updated: true,
      receivedPolicies: merged.receivedPolicies,
      inserted: merged.inserted,
      skipped: merged.skipped,
    };
  }

  async function updateWorkOrderStatus(workOrderId, status) {
    const cfg = assertConfig();
    const resolvedWorkOrderId = requiredString(workOrderId, "workOrderId");
    const resolvedStatus = requiredString(status, "status");
    const rows = await request(
      cfg.tables.workOrders,
      `work_order_id=eq.${filterValue(resolvedWorkOrderId)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: {
          status: resolvedStatus,
          updated_at: new Date().toISOString(),
        },
      },
    );
    if (!Array.isArray(rows) || !rows.length) {
      throw new Error(`Work order not found: ${resolvedWorkOrderId}`);
    }
    return { ok: true, workOrderId: resolvedWorkOrderId, updated: true };
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
    nextWorkOrderId,
    updateWorkOrderGuideline,
    updateWorkOrderResponsibility,
    uploadPublicFile,
    fetchAgentConfig,
    saveAgentConfig,
    fetchKnowledgeBase,
    syncKnowledgeBaseFromAgentResult,
    updateWorkOrderStatus,
  };
})();
