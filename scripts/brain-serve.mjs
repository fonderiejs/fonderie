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
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrain, concept, node, recipe, versionCheck } from './brain-lib.mjs';

const readFileSafe = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// Observability (Phase 2.5 R1 measurement): when FONDERIE_BRAIN_LOG is set,
// append one JSONL record per tool call — timestamp, tool, args, latency, and
// whether the query found a match. Off by default; zero overhead in normal use.
const LOG = process.env.FONDERIE_BRAIN_LOG;
function logCall(rec) {
  if (!LOG) return;
  try { appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...rec }) + '\n'); } catch {}
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const projectDir = arg('--project', process.cwd());
const brainPath = arg('--brain', join(root, '.claude/skills/fonderie/brain.json'));

const brain = loadBrain(brainPath);
const vc = versionCheck(brain, projectDir);
const SERVER = { name: 'fonderie-brain', version: brain.sdkVersions?.core || '0.0.0' };

// --- MCP tool definitions ---------------------------------------------------
// R2 concept enum (BRAIN_PLAN.md "R2 update"): brain_query takes a closed enum
// of language-less concept IDs instead of free text. The model maps the user's
// intent — in any language — onto a concept via the per-value descriptions
// below; lookup is then deterministic (no BM25, no recall, nothing to miss).
const CONCEPT_IDS = Object.keys(brain.concepts || {}).sort();
const conceptMenu = CONCEPT_IDS.map((id) => `  ${id} — ${brain.concepts[id].description}`).join('\n');

const TOOLS = [
  {
    name: 'brain_query',
    description:
      'Fonderie SDK knowledge. Call this BEFORE writing or editing any code that touches auth, billing, orgs/teams, permissions, email, webhooks, rate limiting, or config. Pick the concept matching the task, whatever language it was phrased in. Returns the package to use, how it wires, the canonical recipe, security invariants, and the EXACT TypeScript signatures + routes — everything needed to write correct code in one shot. Do not read @fonderie source or docs — ask here.\nConcepts:\n' +
      conceptMenu,
    inputSchema: {
      type: 'object',
      properties: {
        concept: {
          type: 'string',
          enum: CONCEPT_IDS,
          description: 'The Fonderie capability the task needs (see tool description for what each covers)',
        },
      },
      required: ['concept'],
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

// returns { text, top } — top is the ranked package names (for observability)
function callTool(name, args) {
  if (name === 'brain_query') {
    const c = concept(brain, args?.concept);
    // A wrong/unknown pick gets the full menu back — visible and retryable,
    // unlike a BM25 miss which returned silence.
    if (!c) return { text: versionBanner() + `unknown concept "${args?.concept}". Pick one of:\n${conceptMenu}`, top: [] };
    const top = [c.package.name];
    let out = versionBanner() + `${c.id} — ${c.description}\n`;
    out += `\n@fonderie/${c.package.name}@${c.package.version}  requires:[${c.package.requires.join(', ') || '—'}]  ${c.package.exports.join(', ')}`;
    if (c.recipe) {
      out += `\n\nrecipe: ${c.recipe.name} — ${c.recipe.when}\nwire: ${c.recipe.packages.join(' → ')}`;
      for (const inv of c.recipe.invariants) out += `\n⚠ ${inv}`;
    }
    // Discovery must be ONE-SHOT: the model reliably makes this call and no
    // follow-up drill-down (measured in Phase 4 condition C — brain_node got
    // zero calls even when its description asked for them; the model iterated
    // against tsc instead). So the exact API of the concept's package rides
    // inline, bounded to one package (sufficiency without recreating the
    // all-18-packages fat skill).
    const pkg = c.package.name;
    const sigDir = join(root, '.claude/skills/fonderie/signatures');
    const sig = readFileSafe(join(sigDir, `${pkg}.md`));
    const oc = readFileSafe(join(sigDir, `${pkg}-outcomes.md`));
    if (sig) out += `\n\n--- ${pkg} signatures (exact API — use these, do not guess) ---\n${sig.trim()}`;
    if (oc) out += `\n\n--- ${pkg} outcomes (tables + routes registered) ---\n${oc.trim()}`;
    return { text: out, top };
  }
  if (name === 'brain_node') {
    const n = node(brain, args?.id);
    if (!n) return { text: `no package "${args?.id}" (try one of: ${Object.keys(brain.packages).join(', ')})` };
    return { text: JSON.stringify(n, null, 2) };
  }
  if (name === 'brain_recipe') {
    const r = recipe(brain, args?.name);
    if (!r) return { text: `no recipe "${args?.name}" (available: ${Object.keys(brain.recipes).join(', ')})` };
    return { text: JSON.stringify(r, null, 2) };
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
      const t0 = process.hrtime.bigint();
      const { text, top } = callTool(params?.name, params?.arguments || {});
      const latencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
      const args = params?.arguments || {};
      logCall({
        tool: params?.name,
        arg: args.concept || args.id || args.name || null,
        top: top || null,
        latency_ms: Number(latencyMs.toFixed(2)),
        matched: !/^unknown concept|^no package|^no recipe/.test(text),
        version_skew: !vc.matched,
      });
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
