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
// Unique per run so back-to-back/concurrent invocations never attach to a
// previous, still-shutting-down Chrome instance (port-release race).
const PORT = 9333 + (process.pid % 500);

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

function getJson(p){
  return new Promise((res,rej)=>{
    http.get(`http://127.0.0.1:${PORT}${p}`, r=>{
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try { res(JSON.parse(d)); } catch(e){ rej(e); } });
    }).on('error',rej);
  });
}

// Returns the WebSocket URL of a *page* target (Page.*/Runtime.* domains live on
// page targets, not the browser endpoint that /json/version exposes).
async function getWsUrl(){
  for (let i=0;i<50;i++){
    try {
      const list = await getJson('/json/list');
      const page = Array.isArray(list) && list.find(t=>t.type==='page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await wait(200);
  }
  throw new Error('Chrome CDP page target not reachable');
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
    const seenEvents = new Set();      // CDP event methods received so far
    const eventWaiters = new Map();    // method -> resolver (one-shot)
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
    // Resolves when the named CDP event arrives (or immediately if already seen),
    // falling back to a timeout so a missing event never hangs the harness.
    function waitEvent(method, timeoutMs){
      return new Promise((res)=>{
        if (seenEvents.has(method)) return res(true);
        const t = setTimeout(()=>{ eventWaiters.delete(method); res(false); }, timeoutMs);
        eventWaiters.set(method, ()=>{ clearTimeout(t); res(true); });
      });
    }
    // Drop a previously-seen event so the next waitEvent() waits for a fresh one
    // (the initial about:blank/newtab fires Page.loadEventFired before we navigate).
    function forgetEvent(method){ seenEvents.delete(method); }
    sock.on('data', chunk=>{
      buf = Buffer.concat([buf, chunk]);
      if (!handshook){
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        handshook = true; buf = buf.slice(idx+4); resolve({send, waitEvent, forgetEvent});
      }
      // parse text frames
      while (buf.length >= 2){
        const len0 = buf[1] & 127; let offset = 2, len = len0;
        if (len0 === 126){ len = buf.readUInt16BE(2); offset = 4; }
        else if (len0 === 127){ len = Number(buf.readBigUInt64BE(2)); offset = 10; }
        if (buf.length < offset+len) break;
        const data = buf.slice(offset, offset+len).toString();
        buf = buf.slice(offset+len);
        try {
          const m = JSON.parse(data);
          if (m.id && waiters.has(m.id)){ waiters.get(m.id)(m); waiters.delete(m.id); }
          else if (m.method){
            seenEvents.add(m.method);
            const ew = eventWaiters.get(m.method);
            if (ew){ eventWaiters.delete(m.method); ew(); }
          }
        } catch {}
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
    const { send, waitEvent, forgetEvent } = await connect(wsUrl);
    await send('Page.enable'); await send('Runtime.enable');
    forgetEvent('Page.loadEventFired'); // ignore the initial about:blank load
    await send('Page.navigate', { url: 'file://'+file });
    // Wait for OUR document's load event (not a wall-clock guess): on a cold
    // Chrome start the fixed timer can elapse before navigation even commits,
    // so anchor on the real load before settling. Falls back after 15s so a
    // missing event can never hang the harness.
    await waitEvent('Page.loadEventFired', 15000);
    await wait(2500); // settle fonts/CDN + render + animations after load
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
