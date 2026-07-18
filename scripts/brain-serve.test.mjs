#!/usr/bin/env node
// Smoke test: drives scripts/brain-serve.mjs over real stdio with the MCP
// handshake (initialize → tools/list → tools/call) and asserts the responses.
// Zero deps, exits non-zero on failure — safe for CI.
//
//   node scripts/brain-serve.test.mjs

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const server = spawn('node', [join(here, 'brain-serve.mjs')], { stdio: ['pipe', 'pipe', 'inherit'] });

const pending = new Map();
let buf = '';
server.stdout.on('data', (d) => {
  buf += d;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});

let nextId = 1;
const rpc = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); server.kill(); process.exit(1); } };

const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
assert(init.result?.serverInfo?.name === 'fonderie-brain', 'initialize returns serverInfo');
assert(init.result?.capabilities?.tools, 'advertises tools capability');

const list = await rpc('tools/list', {});
const names = (list.result?.tools || []).map((t) => t.name);
assert(['brain_query', 'brain_node', 'brain_recipe'].every((n) => names.includes(n)), `tools/list has 3 tools (got ${names})`);

const q = await rpc('tools/call', { name: 'brain_query', arguments: { question: 'let people pay' } });
const qText = q.result?.content?.[0]?.text || '';
assert(qText.includes('@fonderie/billing'), 'brain_query "let people pay" → billing');
assert(qText.includes('stripe-checkout'), 'brain_query returns the recipe');

const n = await rpc('tools/call', { name: 'brain_node', arguments: { id: 'workspaces' } });
assert((n.result?.content?.[0]?.text || '').includes('"requires"'), 'brain_node returns edges/requires');

const r = await rpc('tools/call', { name: 'brain_recipe', arguments: { name: 'basic-auth' } });
assert((r.result?.content?.[0]?.text || '').includes('invariants'), 'brain_recipe returns invariants');

const bad = await rpc('tools/call', { name: 'nope', arguments: {} });
assert(bad.error, 'unknown tool → JSON-RPC error');

console.log('brain-serve smoke test: all assertions passed');
server.kill();
process.exit(0);
