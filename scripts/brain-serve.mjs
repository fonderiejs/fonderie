#!/usr/bin/env node
// `fonderie brain serve` — stdio MCP server over brain.json (BRAIN_PLAN.md
// Phase 2). Exposes brain_query / brain_node / brain_recipe so an assistant
// pulls a compact slice instead of reading the Fonderie skill or dist/.
//
// Zero dependencies: implements the MCP stdio transport (newline-delimited
// JSON-RPC 2.0) directly. No LLM anywhere — pure graph lookups.
//
// R3 (version skew): resolves the consuming project's INSTALLED @fonderie/*
// versions and refuses to answer silently when the served brain doesn't match.
//
//   node scripts/brain-serve.mjs [--project <dir>] [--brain <path>]

import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrain, query, node, recipe, versionCheck } from './brain-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const projectDir = arg('--project', process.cwd());
const brainPath = arg('--brain', join(root, '.claude/skills/fonderie/brain.json'));

const brain = loadBrain(brainPath);
const vc = versionCheck(brain, projectDir);
const SERVER = { name: 'fonderie-brain', version: brain.sdkVersions?.core || '0.0.0' };

// --- MCP tool definitions ---------------------------------------------------
const TOOLS = [
  {
    name: 'brain_query',
    description:
      'Fonderie SDK knowledge. Call this BEFORE writing or editing any code that touches auth, billing, orgs/teams, permissions, email, webhooks, rate limiting, or config. Returns the package(s) to use, how they wire together, the canonical recipe, and security invariants. Do not read @fonderie source or docs — ask here.',
    inputSchema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'Natural-language task, e.g. "add team billing"' } },
      required: ['question'],
    },
  },
  {
    name: 'brain_node',
    description: 'Full detail on one @fonderie package: version, requires, exports, tables, routes, and edges.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Package name without the @fonderie/ prefix, e.g. "auth"' } },
      required: ['id'],
    },
  },
  {
    name: 'brain_recipe',
    description: 'Canonical wiring for a named recipe (e.g. "stripe-checkout", "basic-auth") plus its security invariants.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Recipe name' } },
      required: ['name'],
    },
  },
];

// prepend an R3 warning to any query answer when versions are skewed
function versionBanner() {
  if (vc.matched) return '';
  const lines = vc.mismatches.map((m) => `  ${m.pkg}: installed ${m.installed}, brain ${m.brain}`);
  return (
    `⚠ VERSION MISMATCH — this brain does not match your installed @fonderie packages:\n${lines.join('\n')}\n` +
    `The wiring below may reference APIs you don't have. Align versions (npm update or a matching @fonderiejs/cli) before trusting it.\n\n`
  );
}

function callTool(name, args) {
  if (name === 'brain_query') {
    const r = query(brain, args?.question);
    if (!r.packages.length) return versionBanner() + `no Fonderie match for "${r.query}"`;
    let out = versionBanner() + `Q: ${r.query}\n`;
    for (const p of r.packages) out += `\n@fonderie/${p.name}@${p.version}  requires:[${p.requires.join(', ') || '—'}]  ${p.exports.join(', ')}`;
    if (r.recipe) {
      out += `\n\nrecipe: ${r.recipe.name} — ${r.recipe.when}\nwire: ${r.recipe.packages.join(' → ')}`;
      for (const inv of r.recipe.invariants) out += `\n⚠ ${inv}`;
    }
    return out;
  }
  if (name === 'brain_node') {
    const n = node(brain, args?.id);
    if (!n) return `no package "${args?.id}" (try one of: ${Object.keys(brain.packages).join(', ')})`;
    return JSON.stringify(n, null, 2);
  }
  if (name === 'brain_recipe') {
    const r = recipe(brain, args?.name);
    if (!r) return `no recipe "${args?.name}" (available: ${Object.keys(brain.recipes).join(', ')})`;
    return JSON.stringify(r, null, 2);
  }
  throw new Error(`unknown tool: ${name}`);
}

// --- MCP stdio transport (newline-delimited JSON-RPC 2.0) -------------------
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;

  // notifications (no id) — acknowledge by doing nothing
  if (id === undefined || id === null) return;

  try {
    if (method === 'initialize') {
      reply(id, {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER,
      });
    } else if (method === 'tools/list') {
      reply(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      const text = callTool(params?.name, params?.arguments || {});
      reply(id, { content: [{ type: 'text', text }], isError: false });
    } else if (method === 'ping') {
      reply(id, {});
    } else {
      fail(id, -32601, `method not found: ${method}`);
    }
  } catch (e) {
    fail(id, -32603, String(e?.message || e));
  }
});

// startup diagnostics go to stderr so they never corrupt the stdout JSON-RPC stream
process.stderr.write(
  `fonderie-brain serve: ${Object.keys(brain.packages).length} packages, ` +
    `${vc.matched ? 'versions matched' : `${vc.mismatches.length} version mismatch(es)`}\n`,
);
