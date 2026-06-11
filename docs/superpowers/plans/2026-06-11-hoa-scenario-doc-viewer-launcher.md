# HOA Scenario + Linkable Document + Netlify Launcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "HOA / strata exterior" scenario to the agent pipeline with a linkable HOA-document viewer (inline clause peek → full-document modal), and a landing launcher so one Netlify deploy serves both the tenant flow and the agent pipeline.

**Architecture:** Three self-contained HTML files (Tailwind CDN + inlined NeoBrut tokens, no build step). The current `index.html` is renamed to `agent-pipeline.html` and gains a 3rd scenario in its `SCENARIOS` object plus a document modal. A new `index.html` is a NeoBrut launcher. Mock HOA document ships as `hoa-document.js` (global `HOA_DOC`) to avoid `file://` fetch/CORS issues. `netlify.toml` serves the launcher at root.

**Tech Stack:** Plain HTML/CSS/JS, Tailwind Play CDN, NeoBrut design tokens, Material Symbols Sharp. Verification via headless Chrome over CDP (no unit-test framework — this matches the project's established pattern; CONTEXT.md).

---

## Spec reference

Design spec: `docs/superpowers/specs/2026-06-11-hoa-scenario-doc-viewer-launcher-design.md`. All design-language constraints there are binding (NeoBrut tokens, hard offset shadows, `--radius-sm`, pill badges, Barlow uppercase headings, reduced-motion).

## File structure

- **Create** `verify.cjs` — reusable headless-Chrome/CDP verification harness (test-only, may be deleted at the end).
- **Create** `hoa-document.js` — `window.HOA_DOC` mock document data.
- **Rename** `index.html` → `agent-pipeline.html`, then **modify** it (3rd scenario, `riskRow()`, modal, 3-way toggle, Home button, `<script src>` include).
- **Create** new `index.html` — launcher.
- **Modify** `tenant-flow.html` — repoint handoff link, add Home button.
- **Create** `netlify.toml`.
- **Modify** `CONTEXT.md` — housekeeping note.

## Conventions for this plan

- "Test" steps run the headless-Chrome harness `verify.cjs` (created in Task 0) with a per-task probe. The probe prints `PASS`/`FAIL` lines; a task passes only when every line says PASS.
- Chrome path on macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (confirmed present).
- This is NOT a git repo (CONTEXT.md / `git status` both confirm). **Skip all `git add`/`git commit` steps** — there is no VCS here. Where a normal plan would commit, instead run the task's verification and move on. (If a repo is later initialized, commits can be added retroactively.)

---

### Task 0: Verification harness

**Files:**
- Create: `verify.cjs`

This harness launches headless Chrome, loads a local file, runs a probe function in the page (so it can drive clicks and read the DOM after JS executes), and prints PASS/FAIL lines. Reused by every later task.

It is dependency-free: no puppeteer/npm install. It drives Chrome via the DevTools Protocol over a minimal WebSocket client built from Node built-ins only (`http`, `crypto`, `net`). This is the same raw-socket CDP approach CONTEXT.md records as the project's verification method. CDP frames from Chrome are unmasked text frames; the parser below handles 7-/16-/64-bit length encodings, which covers them.

- [ ] **Step 1: Write `verify.cjs`**

Create `verify.cjs` with this exact content:

```js
// Minimal dependency-free headless-Chrome verifier (CDP over raw WebSocket).
// Usage: node verify.cjs <file.html> <probePath.js>
// The probe file must assign `globalThis.__probe = async () => { /* return array of [label, bool] */ }`
const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const net = require('net');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function getWsUrl(){
  for (let i=0;i<50;i++){
    try {
      const json = await new Promise((res,rej)=>{
        http.get(`http://127.0.0.1:${PORT}/json/version`, r=>{
          let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d)));
        }).on('error',rej);
      });
      return json.webSocketDebuggerUrl;
    } catch { await wait(200); }
  }
  throw new Error('Chrome CDP not reachable');
}

// Tiny CDP client over one WebSocket frame protocol (text frames only).
function connect(wsUrl){
  return new Promise((resolve,reject)=>{
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(u.port, u.hostname, ()=>{
      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\n`+
        `Host: ${u.host}\r\n`+
        `Upgrade: websocket\r\nConnection: Upgrade\r\n`+
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buf = Buffer.alloc(0), handshook = false;
    const waiters = new Map(); let id = 0;
    function send(method, params={}){
      return new Promise((res)=>{
        const msg = JSON.stringify({id:++id, method, params});
        waiters.set(id, res);
        const payload = Buffer.from(msg);
        const len = payload.length;
        let header;
        if (len < 126){ header = Buffer.from([0x81, 0x80|len]); }
        else { header = Buffer.from([0x81, 0x80|126, (len>>8)&255, len&255]); }
        const mask = crypto.randomBytes(4);
        const masked = Buffer.alloc(payload.length);
        for (let i=0;i<payload.length;i++) masked[i] = payload[i]^mask[i%4];
        sock.write(Buffer.concat([header, mask, masked]));
      });
    }
    sock.on('data', chunk=>{
      buf = Buffer.concat([buf, chunk]);
      if (!handshook){
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        handshook = true; buf = buf.slice(idx+4); resolve({send});
      }
      // parse text frames
      while (buf.length >= 2){
        const len0 = buf[1] & 127; let offset = 2, len = len0;
        if (len0 === 126){ len = buf.readUInt16BE(2); offset = 4; }
        else if (len0 === 127){ len = Number(buf.readBigUInt64BE(2)); offset = 10; }
        if (buf.length < offset+len) break;
        const data = buf.slice(offset, offset+len).toString();
        buf = buf.slice(offset+len);
        try { const m = JSON.parse(data); if (m.id && waiters.has(m.id)){ waiters.get(m.id)(m); waiters.delete(m.id);} } catch {}
      }
    });
    sock.on('error', reject);
  });
}

(async ()=>{
  const file = path.resolve(process.argv[2]);
  const probeFile = path.resolve(process.argv[3]);
  const probeSrc = fs.readFileSync(probeFile,'utf8');
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/verify-'+Date.now(), '--no-first-run', '--no-default-browser-check',
  ], { stdio:'ignore' });
  let failed = false;
  try {
    const wsUrl = await getWsUrl();
    const { send } = await connect(wsUrl);
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url: 'file://'+file });
    await wait(2500); // allow fonts/CDN + render + animations to settle
    // inject probe and run it
    await send('Runtime.evaluate', { expression: probeSrc });
    const res = await send('Runtime.evaluate', {
      expression: '(async()=>{ const r = await globalThis.__probe(); return JSON.stringify(r); })()',
      awaitPromise: true, returnByValue: true,
    });
    const arr = JSON.parse(res.result.result.value);
    for (const [label, ok] of arr){
      console.log(`${ok?'PASS':'FAIL'}  ${label}`);
      if (!ok) failed = true;
    }
  } catch (e){
    console.log('FAIL  harness error: '+e.message); failed = true;
  } finally {
    chrome.kill();
  }
  process.exit(failed?1:0);
})();
```

- [ ] **Step 2: Smoke-test the harness against the current pipeline**

Create a temp probe `/tmp/probe-smoke.js`:

```js
globalThis.__probe = async () => {
  return [
    ['stepper renders 5 nodes', document.querySelectorAll('.step-node').length === 5],
    ['no missing screens container', !!document.getElementById('screens')],
  ];
};
```

Run: `node verify.cjs index.html /tmp/probe-smoke.js`
Expected output:
```
PASS  stepper renders 5 nodes
PASS  no missing screens container
```
If both PASS, the harness works. (Run this BEFORE the rename in Task 1, while `index.html` is still the pipeline.)

---

### Task 1: Rename pipeline file & repoint handoff

**Files:**
- Rename: `index.html` → `agent-pipeline.html`
- Modify: `tenant-flow.html:474`

- [ ] **Step 1: Rename the file**

Run: `mv index.html agent-pipeline.html`

- [ ] **Step 2: Repoint the tenant-flow handoff link**

In `tenant-flow.html`, change the handoff button at line 474 from:

```html
<a class="btn btn-primary" href="index.html"><span class="icon icon-sm">visibility</span> See the agent work</a>
```
to:
```html
<a class="btn btn-primary" href="agent-pipeline.html"><span class="icon icon-sm">visibility</span> See the agent work</a>
```

- [ ] **Step 3: Verify the rename + link**

Run: `ls agent-pipeline.html && ! test -f index.html && grep -c 'href="agent-pipeline.html"' tenant-flow.html`
Expected: prints `agent-pipeline.html` then `1` (link repointed, old index gone).

Run the smoke probe against the new name:
`node verify.cjs agent-pipeline.html /tmp/probe-smoke.js`
Expected: both lines PASS.

---

### Task 2: Mock HOA document data

**Files:**
- Create: `hoa-document.js`

Content grounded in real public HOA/CC&R sources (hopb.co maintenance-obligations, findhoalaw.com architectural-standards), adapted into the fictional Elmwood Heights community.

- [ ] **Step 1: Write `hoa-document.js`**

Create `hoa-document.js` with this exact content:

```js
/* Mock HOA governing document for the demo's HOA/strata scenario.
   Fictional community ("Elmwood Heights"); clause language adapted from real public
   CC&R / architectural-standards sources (hopb.co, findhoalaw.com). Loaded as a global
   to avoid file:// fetch/CORS issues. */
window.HOA_DOC = {
  title: "Elmwood Heights — Architectural & Exterior Standards",
  subtitle: "Community Association · Strata Title · Adopted 2024",
  sections: [
    { num: "1", heading: "Purpose & Authority", clauses: [
      { id: "1.1", text: "These Standards are adopted by the Association under the Declaration of Covenants, Conditions & Restrictions (CC&Rs) to preserve the aesthetic quality, uniformity, and property values of the community." },
      { id: "1.2", text: "Where these Standards clarify an ambiguous provision of the CC&Rs, they shall be applied consistently and in good faith to all members." },
    ]},
    { num: "2", heading: "Maintenance Obligations", clauses: [
      { id: "2.1", text: "The Association maintains, repairs, and replaces the common areas. Each homeowner maintains their separate interest, including the exterior surfaces of their dwelling, except where expressly assigned to the Association." },
      { id: "2.2", text: "Routine upkeep of an exterior surface (cleaning, touch-up, refinishing) is the homeowner's responsibility. Structural repair of common elements is the Association's responsibility. Ambiguous cases are resolved by the Board." },
    ]},
    { num: "3", heading: "General Exterior Appearance", clauses: [
      { id: "3.1", text: "All dwellings shall present a clean, well-maintained, and uniform exterior appearance consistent with the community's adopted scheme." },
      { id: "3.2", text: "Visible deterioration — including fading, staining, or surface damage — shall be remedied promptly by the responsible party." },
    ]},
    { num: "4", heading: "Exterior Surfaces & Finishes", clauses: [
      { id: "4.1", text: "Approved materials & finishes. Exterior cladding, trim, and corner boards shall use materials and finishes from the Association's approved schedule. Substitutions require Architectural Committee approval." },
      { id: "4.2", text: "Surface integrity. All visible exterior surfaces — siding, trim, corners, and fascia — shall be maintained free of chips, cracks, peeling, and exposed substrate. The homeowner shall remedy any such condition within thirty (30) days of written notice, using association-approved materials and colours per §4.3." },
      { id: "4.3", text: "Colour palette & approval. Exterior repairs and repainting must conform to the Association's approved colour scheme. Use of any colour outside the approved palette requires prior written approval and may be refused to preserve community uniformity." },
      { id: "4.4", text: "Architectural review. Visible exterior modifications and non-like-for-like repairs require prior approval by the Architectural Committee, which shall respond within thirty (30) days of a complete application. Like-for-like remediation under §4.2 using approved materials does not require pre-approval." },
    ]},
    { num: "5", heading: "Landscaping & Common Areas", clauses: [
      { id: "5.1", text: "The Association maintains community landscaping and shared grounds. Homeowners shall not alter common-area planting or hardscape without approval." },
      { id: "5.2", text: "Personal exterior items (fixtures, signage, decorations) shall comply with the General Exterior Appearance standards in §3." },
    ]},
  ],
};
```

- [ ] **Step 2: Verify it parses and has the cited clauses**

Run: `node -e "require('./hoa-document.js' .replace('./','./')); " 2>/dev/null; node -e "global.window={}; require('./hoa-document.js'); const d=window.HOA_DOC; const ids=d.sections.flatMap(s=>s.clauses.map(c=>c.id)); console.log('clauses', ids.length); console.log('has 4.2/4.3/4.4', ['4.2','4.3','4.4'].every(x=>ids.includes(x)));"`
Expected:
```
clauses 12
has 4.2/4.3/4.4 true
```

---

### Task 3: Include the doc script + add the `hoa` scenario data

**Files:**
- Modify: `agent-pipeline.html` (head `<script>` include; `SCENARIOS` object)

- [ ] **Step 1: Include `hoa-document.js`**

In `agent-pipeline.html`, immediately after the Tailwind CDN line (`<script src="https://cdn.tailwindcss.com"></script>`, line ~9), add:

```html
<script src="hoa-document.js"></script>
```

- [ ] **Step 2: Add the `hoa` scenario to `SCENARIOS`**

In `agent-pipeline.html`, the `SCENARIOS` object currently has keys `clear` and `conflict` (starts ~line 214). Add a third key `hoa` as a sibling (insert before the closing `};` of `SCENARIOS`). Use the existing partial helpers (`field`, `doc`, `reason`, `vendor`, `scoreTile`, `kv`, `timeline`, `choice`) exactly as the other scenarios do. The new `riskRow()` helper (Task 4) is referenced in screen 3 — it will exist by the time screens render, so referencing it here is fine (functions are defined before `renderScreen` runs).

Insert this scenario:

```js
  hoa: {
    name: 'HOA exterior — strata',
    wo: 'WO-20495',
    finalStatus: 'Auto-dispatched',
    screens: [
      // 1 — Issue submitted
      () => `
        <div class="mb-4">
          <div class="label mb-1">Issue submitted</div>
          <h2 class="h2">Chipped exterior corner</h2>
          <div style="font-family:var(--font-display); font-size:18px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--orange-600);">Unit 12 · 14 Birch Lane · Elmwood Heights HOA</div>
        </div>
        <div class="card reveal">
          <div class="label mb-2">Raw report · <span class="mono">${'WO-20495'}</span></div>
          <p class="body-lg" style="margin-bottom:var(--sp-3);">"Front-left corner of the house is chipped — paint flaked off and the bare board is showing. We're in a strata/HOA community, not sure who fixes this."</p>
          <div class="flex gap-2 flex-wrap">
            <span class="badge badge-neutral">SMS intake</span>
            <span class="badge badge-blue"><span class="icon icon-sm">apartment</span> Strata title</span>
            <span class="badge badge-neutral">Photo attached</span>
          </div>
        </div>`,
      // 2 — Parse intent
      () => `
        <div class="mb-4"><div class="label mb-1">Parse intent</div><h2 class="h2">Structured fields</h2></div>
        <div class="grid md:grid-cols-2 gap-3">
          ${field('Trade','Exterior / facade','Repaint & refinish','High','ok')}
          ${field('Asset','Exterior corner / siding','Front-left corner board','High','ok')}
          ${field('Ownership context','HOA — strata title','Governed by HOA standards','High','ok')}
          ${field('Urgency','Standard','Cosmetic, not structural','High','ok')}
          ${field('Unit','12 · 14 Birch Lane','Elmwood Heights','High','ok')}
          ${field('Duplicate check','No duplicate','First report this address','High','ok')}
        </div>`,
      // 3 — Responsibility check (the centrepiece)
      () => `
        <div class="mb-4"><div class="label mb-1">Responsibility check</div><h2 class="h2">Who is responsible?</h2></div>
        <div class="mb-4">
          ${doc('HOA — Architectural & Exterior Standards','Elmwood Heights. Governs exterior appearance, surfaces, and approvals. Applicable to this report.','Applies','ok')}
          ${doc('Strata schedule / lot maintenance note','Exterior surface upkeep of a lot sits with the homeowner unless a common element. No conflict.','','neutral')}
        </div>
        <div class="label mb-2">Guideline risks flagged</div>
        ${riskRow(1,'Exterior finish below standard','Chip exposes bare substrate — violates the uniform-finish requirement for visible surfaces.','4.2','§4.2 Surface integrity','Schedule exterior refinish')}
        ${riskRow(2,'Repair must match approved palette','Any refinish must use the approved colour scheme; non-like-for-like work needs committee approval.','4.3','§4.3 Colour palette',"Use HOA-approved materials/colour", '4.4','§4.4 Architectural review')}
        <div class="tile reveal mt-3" style="background:var(--lime-50); border-color:var(--lime-600);">
          <div class="label mb-1">Responsibility</div>
          <div style="font-weight:700; color:var(--lime-800);">Homeowner responsibility confirmed</div>
          <div class="body-sm mb-2" style="color:var(--ink);"><span data-counter="88">0</span>% · above 70% auto-dispatch threshold</div>
          <div style="height:10px; background:var(--gray-50); border:var(--border); border-radius:var(--radius-pill); overflow:hidden;">
            <div class="meter-fill" data-meter="88" style="height:100%; width:0; background:var(--lime-600);"></div>
          </div>
        </div>`,
      // 4 — Work routing
      () => `
        <div class="mb-4"><div class="label mb-1">Work routing</div><h2 class="h2">Vendor shortlist</h2></div>
        ${vendor('FR','FacadeRight Exteriors','Exterior refinish · 1.2km · HOA-approved materials','94',true)}
        ${vendor('UC','UrbanCoat Painting','Repaint · 3.4km · palette match','88',false)}
        ${vendor('PB','PrimeBoard Repairs','Siding/board · 5.1km','81',false)}
        <div class="tile reveal mt-2" style="background:var(--blue-50); border-color:var(--blue-600);">
          <span class="label" style="color:var(--blue-800);">Selected vendor will use HOA-approved materials & colour per §4.3.</span>
        </div>`,
      // 5 — Dispatched
      () => `
        <div class="mb-4"><div class="label mb-1">Dispatched</div><h2 class="h2">Work order routed</h2></div>
        <div class="card reveal mb-3">
          <div class="label mb-1">Work order · <span class="mono">WO-20495</span></div>
          ${kv('Assigned to','FacadeRight Exteriors','Efficiency 94')}
          ${kv('Billed to','Homeowner','HOA §4.2 surface duty')}
          ${kv('Materials','HOA-approved palette','Per §4.3')}
        </div>
        ${timeline([
          ['10:02','Issue parsed','Exterior / facade · strata title · 6 fields high-confidence'],
          ['10:02','Responsibility confirmed','HOA §4.2 · homeowner · 88% · no escalation'],
          ['10:03','Vendor dispatched','FacadeRight Exteriors · materials per §4.3'],
        ])}`,
    ],
  },
```

- [ ] **Step 3: Verify the scenario object is syntactically valid**

Run: `node -e "const fs=require('fs'); const h=fs.readFileSync('agent-pipeline.html','utf8'); const s=h.match(/<script>([\s\S]*?)<\/script>/g).map(x=>x.replace(/<\/?script>/g,'')).join('\n'); fs.writeFileSync('/tmp/ap.js', s.replace(/<script src=.*?>/g,'')); " && echo extracted`
Then: `node --check /tmp/ap.js`
Expected: `extracted` then no output from `--check` (syntax OK). NOTE: `--check` will fail here because the script references `document`/`window` only at runtime, not parse time — `--check` only checks syntax, so it should pass. If it errors on syntax, fix the inserted block.

(Full render is verified in Task 4 after `riskRow` exists.)

---

### Task 4: `riskRow()` helper + expand interaction

**Files:**
- Modify: `agent-pipeline.html` (add helper near other partials ~line 519–577; add expand CSS; add delegated listener)

- [ ] **Step 1: Add the `riskRow()` helper**

In `agent-pipeline.html`, after the `scoreTile()` function (ends ~line 577), add:

```js
/* HOA risk row — collapsible. Tier-1 inline peek; the Guideline link opens the modal.
   Optional 2nd clause via clause2/label2. Clause snippet text comes from HOA_DOC. */
function clauseSnippet(id){
  const doc = (window.HOA_DOC && window.HOA_DOC.sections) || [];
  for (const s of doc){ for (const c of s.clauses){ if (c.id===id) return c.text; } }
  return 'Clause text unavailable.';
}
function riskRow(n, title, body, clauseId, clauseLabel, actLabel, clause2, clause2Label){
  const snippet = clauseSnippet(clauseId);
  const link2 = clause2 ? `<button class="risk-link badge badge-blue" data-clause="${clause2}" style="cursor:pointer;"><span class="icon icon-sm">description</span> ${clause2Label} <span class="icon icon-sm">arrow_forward</span></button>` : '';
  return `
    <div class="risk reveal" data-risk="${n}" style="border:var(--border); border-radius:var(--radius-sm); box-shadow:var(--shadow-sm); margin-bottom:var(--sp-2); background:var(--white); overflow:hidden;">
      <button class="risk-head" aria-expanded="false" style="all:unset; cursor:pointer; display:flex; align-items:center; gap:var(--sp-3); padding:var(--sp-3); width:100%; box-sizing:border-box;">
        <span style="width:26px; height:26px; border:var(--border); border-radius:var(--radius-pill); background:var(--orange-600); color:#fff; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:800; font-size:13px; flex-shrink:0;">${n}</span>
        <span style="flex:1; min-width:0;">
          <span style="display:block; font-weight:700;">${title}</span>
          <span class="body-sm" style="color:var(--gray-600);">${body}</span>
        </span>
        <span class="icon risk-chevron" style="color:var(--gray-600); font-variation-settings:'FILL' 1;">expand_more</span>
      </button>
      <div class="risk-body" style="display:none; padding:var(--sp-3); background:var(--gray-50); border-top:var(--border); border-left:4px solid var(--orange-600);">
        <div class="label mb-1">Source · HOA Architectural &amp; Exterior Standards</div>
        <div class="body-sm" style="color:var(--ink); margin-bottom:var(--sp-3);">${snippet}</div>
        <div class="flex items-center gap-2 flex-wrap">
          <button class="risk-link badge badge-blue" data-clause="${clauseId}" style="cursor:pointer;"><span class="icon icon-sm">description</span> ${clauseLabel} <span class="icon icon-sm">arrow_forward</span></button>
          ${link2}
          <span class="badge badge-lime" style="margin-left:auto;"><span class="icon icon-sm">task_alt</span> ${actLabel}</span>
        </div>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Add the expand listener (delegated)**

In `agent-pipeline.html`, in the WIRE UP section (after the keydown listener, before `// init` ~line 760), add a delegated click handler on the screens container. Note `screensEl` already exists (line ~612):

```js
/* HOA risk-row expand/collapse (delegated; survives re-render) */
screensEl.addEventListener('click', e=>{
  const head = e.target.closest('.risk-head');
  if (!head) return;
  const body = head.parentElement.querySelector('.risk-body');
  const chev = head.querySelector('.risk-chevron');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  head.setAttribute('aria-expanded', String(!open));
  if (chev) chev.textContent = open ? 'expand_more' : 'expand_less';
});
```

- [ ] **Step 3: Verify the HOA scenario renders with 2 risk rows that expand**

Create `/tmp/probe-hoa.js`:

```js
globalThis.__probe = async () => {
  // switch to hoa scenario directly
  window.setScenario('hoa');
  // advance to step 3 (responsibility) — index 2
  window.stepIndex = 2; window.renderStepper(); window.renderScreen();
  await new Promise(r=>setTimeout(r,300));
  const rows = document.querySelectorAll('.risk');
  const before = document.querySelector('.risk-body').style.display;
  document.querySelector('.risk-head').click();
  await new Promise(r=>setTimeout(r,100));
  const after = document.querySelector('.risk-body').style.display;
  const link = document.querySelector('.risk-link[data-clause="4.2"]');
  return [
    ['hoa scenario selectable', window.SCENARIOS && !!window.SCENARIOS.hoa],
    ['exactly 2 risk rows', rows.length === 2],
    ['risk body starts collapsed', before === 'none'],
    ['risk body expands on click', after === 'block'],
    ['guideline link for 4.2 present', !!link],
  ];
};
```

Run: `node verify.cjs agent-pipeline.html /tmp/probe-hoa.js`
Expected: all 5 lines PASS.

(For this probe to work, `setScenario`, `stepIndex`, `renderStepper`, `renderScreen`, and `SCENARIOS` must be reachable on `window`. They are top-level `function`/`let` declarations in the page's single inline `<script>`, which makes function declarations global but `let`/`const` are NOT on `window`. **Add an explicit export** in Step 4 below so the probe can drive state.)

- [ ] **Step 4: Expose state for verification**

In `agent-pipeline.html`, just before `// init` (~line 762), add:

```js
// expose for headless verification (harmless in prod)
window.SCENARIOS = SCENARIOS;
window.setScenario = setScenario;
window.renderStepper = renderStepper;
window.renderScreen = renderScreen;
Object.defineProperty(window, 'stepIndex', { get:()=>stepIndex, set:v=>{stepIndex=v;} });
```

Re-run Step 3's probe. Expected: all 5 PASS.

---

### Task 5: Document modal + `openHoaDoc()`

**Files:**
- Modify: `agent-pipeline.html` (modal markup in `<body>`; modal JS; wire risk-link clicks; reduced-motion CSS)

- [ ] **Step 1: Add the modal markup**

In `agent-pipeline.html`, just before the closing `</body>` (after the `<script>`… actually before `<script>` so it exists at parse time — insert right after `<main>`/`#screens` block, i.e. after line ~202 `</main>` equivalent; safest: immediately before the `<script>` tag at line ~204). Insert:

```html
<!-- HOA document modal -->
<div id="hoaModal" style="display:none; position:fixed; inset:0; z-index:100; align-items:center; justify-content:center; padding:var(--sp-4);">
  <div id="hoaScrim" style="position:absolute; inset:0; background:rgba(13,13,13,0.5);"></div>
  <div role="dialog" aria-modal="true" aria-labelledby="hoaModalTitle"
       style="position:relative; background:var(--white); border:var(--border); border-radius:var(--radius-sm); box-shadow:var(--shadow-lg); max-width:560px; width:100%; max-height:80vh; display:flex; flex-direction:column;">
    <div style="background:var(--ink); color:#fff; padding:var(--sp-3) var(--sp-4); display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3);">
      <span id="hoaModalTitle" style="font-family:var(--font-display); font-weight:800; text-transform:uppercase; letter-spacing:0.02em; font-size:16px;">HOA Document</span>
      <button id="hoaClose" aria-label="Close" class="btn btn-sm" style="background:transparent; border-color:var(--gray-600); color:#fff; padding:6px;"><span class="icon icon-sm">close</span></button>
    </div>
    <div id="hoaBody" style="padding:var(--sp-4); overflow:auto;"></div>
  </div>
</div>
```

- [ ] **Step 2: Add modal JS**

In `agent-pipeline.html`, add near the other functions (after `riskRow`/`clauseSnippet`):

```js
/* HOA document modal */
let hoaRendered = false, hoaLastTrigger = null;
function renderHoaDoc(){
  const body = document.getElementById('hoaBody');
  const d = window.HOA_DOC;
  if (!d){ body.innerHTML = '<p class="body-lg">Document unavailable.</p>'; return; }
  document.getElementById('hoaModalTitle').textContent = d.title;
  body.innerHTML = `<div class="label mb-3">${d.subtitle}</div>` + d.sections.map(s=>`
    <div style="margin-bottom:var(--sp-4);">
      <div style="font-family:var(--font-display); font-weight:700; text-transform:uppercase; letter-spacing:0.04em; font-size:16px; margin-bottom:var(--sp-2);">§${s.num} ${s.heading}</div>
      ${s.clauses.map(c=>`<div id="clause-${c.id}" class="hoa-clause" style="border:var(--border); border-radius:var(--radius-sm); padding:var(--sp-3); margin-bottom:var(--sp-2); background:var(--white);"><span class="mono" style="color:var(--blue-600);">§${c.id}</span> <span class="body-sm" style="color:var(--ink);">${c.text}</span></div>`).join('')}
    </div>`).join('');
  hoaRendered = true;
}
function openHoaDoc(clauseId){
  const modal = document.getElementById('hoaModal');
  if (!hoaRendered) renderHoaDoc();
  hoaLastTrigger = document.activeElement;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // clear previous highlight
  document.querySelectorAll('.hoa-clause.is-cited').forEach(el=>{
    el.classList.remove('is-cited');
    el.style.background = 'var(--white)';
    el.style.boxShadow = 'none';
    el.style.borderColor = 'var(--ink)';
  });
  const target = clauseId && document.getElementById('clause-'+clauseId);
  if (target){
    target.classList.add('is-cited');
    target.style.background = 'var(--orange-50)';
    target.style.borderColor = 'var(--orange-600)';
    target.style.boxShadow = 'var(--shadow-sm)';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }
  document.querySelector('#hoaModal [role=dialog]').focus?.();
}
function closeHoaDoc(){
  document.getElementById('hoaModal').style.display = 'none';
  document.body.style.overflow = '';
  if (hoaLastTrigger && hoaLastTrigger.focus) hoaLastTrigger.focus();
}
```

- [ ] **Step 3: Wire the link clicks + close interactions**

In the WIRE UP section, extend the delegated screens listener from Task 4 OR add a second delegated handler. Add (after the risk-head handler):

```js
/* Guideline link → open modal (delegated) */
screensEl.addEventListener('click', e=>{
  const link = e.target.closest('.risk-link');
  if (!link) return;
  openHoaDoc(link.getAttribute('data-clause'));
});
document.getElementById('hoaClose').addEventListener('click', closeHoaDoc);
document.getElementById('hoaScrim').addEventListener('click', closeHoaDoc);
document.addEventListener('keydown', e=>{ if (e.key==='Escape') closeHoaDoc(); });
```

Also expose for verification — add to the verification export block (Task 4 Step 4):

```js
window.openHoaDoc = openHoaDoc;
window.closeHoaDoc = closeHoaDoc;
```

- [ ] **Step 4: Verify the modal opens, scrolls/highlights, retargets, and closes**

Create `/tmp/probe-modal.js`:

```js
globalThis.__probe = async () => {
  window.setScenario('hoa'); window.stepIndex = 2; window.renderStepper(); window.renderScreen();
  await new Promise(r=>setTimeout(r,200));
  document.querySelector('.risk-head').click();
  await new Promise(r=>setTimeout(r,80));
  // open via 4.2 link
  document.querySelector('.risk-link[data-clause="4.2"]').click();
  await new Promise(r=>setTimeout(r,120));
  const modal = document.getElementById('hoaModal');
  const open = getComputedStyle(modal).display !== 'none';
  const cited42 = document.getElementById('clause-4.2').classList.contains('is-cited');
  // retarget to 4.3
  window.openHoaDoc('4.3');
  await new Promise(r=>setTimeout(r,80));
  const cited43 = document.getElementById('clause-4.3').classList.contains('is-cited');
  const not42 = !document.getElementById('clause-4.2').classList.contains('is-cited');
  // full doc rendered: 12 clauses
  const clauseCount = document.querySelectorAll('.hoa-clause').length;
  window.closeHoaDoc();
  await new Promise(r=>setTimeout(r,50));
  const closed = getComputedStyle(modal).display === 'none';
  return [
    ['modal opens on guideline link', open],
    ['clause 4.2 highlighted', cited42],
    ['retarget highlights 4.3', cited43],
    ['retarget clears 4.2 highlight', not42],
    ['full document rendered (12 clauses)', clauseCount === 12],
    ['modal closes', closed],
  ];
};
```

Run: `node verify.cjs agent-pipeline.html /tmp/probe-modal.js`
Expected: all 6 lines PASS.

---

### Task 6: 3-way scenario toggle + Home button on pipeline

**Files:**
- Modify: `agent-pipeline.html` (`setScenario` label, toggle handler, header Home button)

- [ ] **Step 1: Make `setScenario` label all three scenarios**

In `agent-pipeline.html`, replace the label line in `setScenario` (currently `'Scenario: ' + (key==='clear' ? 'Clear path' : 'Conflict');`) with:

```js
  const labels = { clear:'Clear path', conflict:'Conflict', hoa:'HOA exterior' };
  document.getElementById('scenarioLabel').textContent = 'Scenario: ' + labels[key];
```

- [ ] **Step 2: Make the toggle cycle through three**

Replace the `scenarioToggle` click handler body (currently `setScenario(scenarioKey==='clear' ? 'conflict' : 'clear');`) with:

```js
document.getElementById('scenarioToggle').addEventListener('click', ()=>{
  setAutoplay(false);
  const order = ['clear','conflict','hoa'];
  const next = order[(order.indexOf(scenarioKey)+1) % order.length];
  setScenario(next);
});
```

- [ ] **Step 3: Add a Home button to the far left of the header**

In `agent-pipeline.html`, the header's left group is `<div class="flex items-center gap-4">` (line ~166), whose first child is the "Lessen Ops" logo `<div>`. Insert the Home link as the new FIRST child of that group, immediately after `<div class="flex items-center gap-4">`:

```html
<a href="index.html" class="btn btn-sm" aria-label="Home" style="background:transparent; border-color:var(--gray-600); color:#fff; padding:6px;"><span class="icon icon-sm">grid_view</span></a>
```

- [ ] **Step 4: Verify 3-way cycle + Home link**

Create `/tmp/probe-toggle.js`:

```js
globalThis.__probe = async () => {
  const btn = document.getElementById('scenarioToggle');
  const label = ()=>document.getElementById('scenarioLabel').textContent;
  const seen = [];
  for (let i=0;i<3;i++){ btn.click(); await new Promise(r=>setTimeout(r,150)); seen.push(label()); }
  const home = document.querySelector('header a[href="index.html"]');
  return [
    ['cycles to Conflict', seen.includes('Scenario: Conflict')],
    ['cycles to HOA exterior', seen.includes('Scenario: HOA exterior')],
    ['cycles back to Clear path', seen.includes('Scenario: Clear path')],
    ['home link in header', !!home],
  ];
};
```

Run: `node verify.cjs agent-pipeline.html /tmp/probe-toggle.js`
Expected: all 4 lines PASS.

---

### Task 7: New launcher `index.html`

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write the launcher**

Create `index.html`. Copy the `:root` token block + base font/icon CSS from `agent-pipeline.html`'s `<head>` (so the launcher matches exactly). Use this content (the `<style>` token block must be the SAME tokens as the other pages — copy them verbatim from `agent-pipeline.html` lines ~10–60):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lessen Ops — Demo Launcher</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;700&family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,400,1,0&display=swap" rel="stylesheet">
<style>
  :root{
    --blue-50:#E6EFFC; --blue-300:#7AAAE8; --blue-600:#0A4FBF; --blue-800:#063380;
    --orange-50:#FDEEE5; --orange-300:#F0A06A; --orange-600:#D65905; --orange-800:#8A3903;
    --lime-50:#F5FAD6; --lime-300:#D4E84A; --lime-600:#8FB800; --lime-800:#597300;
    --white:#F2F5FB; --gray-50:#E8EDF7; --gray-600:#525A6A; --ink:#0D0D0D;
    --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px; --sp-12:48px; --sp-16:64px;
    --border:2px solid var(--ink);
    --shadow-sm:3px 3px 0 var(--ink); --shadow-md:4px 4px 0 var(--ink); --shadow-lg:6px 6px 0 var(--ink);
    --radius-none:0px; --radius-sm:4px; --radius-pill:999px;
    --font-display:'Barlow Condensed',sans-serif; --font-body:'DM Sans',sans-serif;
    --font-mono:ui-monospace,'Cascadia Code',monospace; --font-icon:'Material Symbols Sharp';
  }
  *,*::before,*::after{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:var(--font-body); background:var(--white); color:var(--ink); line-height:1.7; -webkit-font-smoothing:antialiased; }
  .label{ font-family:var(--font-body); font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--gray-600); }
  .h1{ font-family:var(--font-display); font-size:48px; font-weight:800; line-height:1.05; text-transform:uppercase; letter-spacing:0.02em; }
  .body-lg{ font-family:var(--font-body); font-size:15px; font-weight:400; line-height:1.7; }
  .icon{ font-family:var(--font-icon); font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0; line-height:1; display:inline-flex; align-items:center; user-select:none; }
  .icon-lg{ font-size:28px; } .icon-xl{ font-size:36px; }
  .card{ background:var(--white); border:var(--border); border-radius:var(--radius-sm); box-shadow:var(--shadow-lg); padding:var(--sp-6); }
  .card-interactive{ cursor:pointer; transition:transform .1s ease, box-shadow .1s ease; text-decoration:none; color:inherit; display:block; }
  .card-interactive:hover{ transform:translate(-2px,-2px); box-shadow:8px 8px 0 var(--ink); }
  .card-interactive:active{ transform:translate(4px,4px); box-shadow:none; }
  @media (prefers-reduced-motion: reduce){ *,*::before,*::after{ transition-duration:0ms !important; } }
</style>
</head>
<body>
<header style="background:var(--ink); border-bottom:var(--border);" class="px-4 md:px-8 py-3 flex items-center">
  <div style="font-family:var(--font-display); font-size:20px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#fff;">
    Lessen <span style="color:var(--lime-300);">Ops</span>
  </div>
</header>
<main class="mx-auto" style="max-width:880px; padding:var(--sp-16) var(--sp-4);">
  <div class="label" style="margin-bottom:var(--sp-3);">Hackathon demo · AI work-order pipeline</div>
  <h1 class="h1" style="margin-bottom:var(--sp-4);">Pick a view</h1>
  <p class="body-lg" style="max-width:560px; color:var(--gray-600); margin-bottom:var(--sp-12);">
    Two ways into the same product: report an issue as a resident, or watch the agent parse the report, decide responsibility against the lease / HOA documents, and route a vendor.
  </p>
  <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:var(--sp-6);">
    <a class="card card-interactive" href="tenant-flow.html">
      <span class="icon icon-xl" style="color:var(--orange-600);">smartphone</span>
      <div style="font-family:var(--font-display); font-size:24px; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; margin:var(--sp-3) 0 var(--sp-2);">Tenant flow</div>
      <p class="body-lg" style="color:var(--gray-600);">Report a maintenance issue as a resident and see the agent's summary &amp; confirmation.</p>
    </a>
    <a class="card card-interactive" href="agent-pipeline.html">
      <span class="icon icon-xl" style="color:var(--blue-600);">smart_toy</span>
      <div style="font-family:var(--font-display); font-size:24px; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; margin:var(--sp-3) 0 var(--sp-2);">Agent — behind the scenes</div>
      <p class="body-lg" style="color:var(--gray-600);">Watch the 5-step pipeline: parse → responsibility → routing. Clear, conflict, and HOA scenarios.</p>
    </a>
  </div>
</main>
</body>
</html>
```

- [ ] **Step 2: Verify the launcher cards link correctly**

Create `/tmp/probe-launcher.js`:

```js
globalThis.__probe = async () => {
  const a = [...document.querySelectorAll('a.card-interactive')].map(x=>x.getAttribute('href'));
  return [
    ['tenant card links to tenant-flow.html', a.includes('tenant-flow.html')],
    ['agent card links to agent-pipeline.html', a.includes('agent-pipeline.html')],
    ['two launcher cards', a.length === 2],
  ];
};
```

Run: `node verify.cjs index.html /tmp/probe-launcher.js`
Expected: all 3 lines PASS.

---

### Task 8: Home button on tenant flow

**Files:**
- Modify: `tenant-flow.html` (header)

- [ ] **Step 1: Add Home button to tenant-flow header**

In `tenant-flow.html`, the `<header>` (line ~185) has a left group `<div class="flex items-center gap-3">` containing the logo, and a right `#progress` div. Insert as the FIRST child of the left group:

```html
<a href="index.html" class="btn btn-sm" aria-label="Home" style="background:transparent; border-color:var(--gray-600); color:#fff; padding:6px;"><span class="icon icon-sm">grid_view</span></a>
```

- [ ] **Step 2: Verify Home link present**

Create `/tmp/probe-tenant-home.js`:

```js
globalThis.__probe = async () => {
  const home = document.querySelector('header a[href="index.html"]');
  return [['tenant header has home link', !!home]];
};
```

Run: `node verify.cjs tenant-flow.html /tmp/probe-tenant-home.js`
Expected: PASS.

---

### Task 9: Netlify config

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Write `netlify.toml`**

Create `netlify.toml`:

```toml
[build]
  publish = "."

# Static site, no build command. index.html is served at the site root.
```

- [ ] **Step 2: Verify**

Run: `test -f netlify.toml && grep -q 'publish = "."' netlify.toml && echo OK`
Expected: `OK`

---

### Task 10: Update CONTEXT.md + full regression pass

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Update CONTEXT.md**

In `CONTEXT.md`, under "What's built so far", update the `index.html` heading to reflect the rename and add the HOA scenario + launcher. Replace the line `### \`index.html\` — DONE & VERIFIED ✅` heading's body intro to note: the pipeline now lives in `agent-pipeline.html` with **three** scenarios (clear, conflict, HOA), `index.html` is now a launcher, and a linkable HOA document modal (`hoa-document.js`) backs the HOA responsibility step. Add a one-line note that the file ownership ("Claude owns index.html") now refers to `agent-pipeline.html`.

(Exact prose is housekeeping; keep it factual and short. No functional code here.)

- [ ] **Step 2: Full regression — run every probe against the final files**

Run each in turn; all must be fully PASS:

```
node verify.cjs agent-pipeline.html /tmp/probe-hoa.js
node verify.cjs agent-pipeline.html /tmp/probe-modal.js
node verify.cjs agent-pipeline.html /tmp/probe-toggle.js
node verify.cjs index.html /tmp/probe-launcher.js
node verify.cjs tenant-flow.html /tmp/probe-tenant-home.js
```

Plus a clean-load console-error check. Create `/tmp/probe-clean.js`:

```js
globalThis.__probe = async () => {
  // existing scenarios still work
  window.setScenario('clear'); window.renderScreen();
  await new Promise(r=>setTimeout(r,150));
  const stepperOk = document.querySelectorAll('.step-node').length === 5;
  window.setScenario('conflict'); window.renderScreen();
  await new Promise(r=>setTimeout(r,150));
  const conflictOk = !!document.getElementById('screens').innerHTML;
  return [
    ['clear scenario stepper intact', stepperOk],
    ['conflict scenario still renders', conflictOk],
  ];
};
```

Run: `node verify.cjs agent-pipeline.html /tmp/probe-clean.js`
Expected: both PASS (no regression to existing scenarios).

- [ ] **Step 3: Optional cleanup**

If desired, remove the verification harness and temp probes (they are dev-only and need not ship):
Run: `rm -f verify.cjs /tmp/probe-*.js /tmp/ap.js`
(Leave `verify.cjs` in place if you want repeatable checks later — it's harmless and not linked from any page.)

---

## Self-review notes

- **Spec coverage:** launcher (Task 7), file rename + relink (Task 1), `hoa` scenario (Task 3), 2 risk rows (Task 3/4), inline peek + modal two-tier (Tasks 4–5), mock doc grounded in real sources (Task 2), 3-way toggle (Task 6), Home switcher (Tasks 6/8), netlify.toml (Task 9), reduced-motion + scrim-no-blur + tokens (Tasks 5/7 — design constraints applied inline), verification (Task 0 + per-task + regression Task 10). All spec sections mapped.
- **No unit-test framework:** intentionally replaced with headless-Chrome probes per CONTEXT.md's established pattern; each task has executable verification with expected output.
- **Type/name consistency:** `riskRow(n,title,body,clauseId,clauseLabel,actLabel,clause2,clause2Label)` defined in Task 4 and called in Task 3 with matching arg order (2-clause form for RISK #2). `openHoaDoc(clauseId)` / `closeHoaDoc()` consistent across Tasks 5–6. `setScenario`/`renderScreen`/`renderStepper`/`SCENARIOS`/`stepIndex` exposed on `window` (Task 4 Step 4) and used by every probe.
- **No git:** all commit steps omitted (not a repo); verification gates each task instead.
```
