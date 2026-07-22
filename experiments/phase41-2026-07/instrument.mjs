#!/usr/bin/env node
// Transcript-level Fonderie-knowledge attribution (DECISION-instrument-first.md).
// Replaces the two bad proxies (Method A resident-only, Method B turn-confounded)
// with a direct, turn-NEUTRAL measurement from the captured pilot transcripts.
//
//   node instrument.mjs [--results <dir>]
//
// Per session it separates two axes the pilot's Method B wrongly conflated:
//   (1) per-turn Fonderie-KNOWLEDGE footprint  = resident_K + fetched/turns
//       (turn-neutral — "how heavy is the knowledge carried each turn")
//   (2) turn COUNT  (efficiency — a different finding, not knowledge overhead)
//
// resident_K : meta.k_tokens (pb/pb-scoped = CLAUDE.md, fat = skill dir, scratch 0)
// fetched    : Σ tokens of brain_query tool_results (matched tool_use→tool_result
//              by id), i.e. Fonderie knowledge pulled INTO context at runtime.
// The pb/fat ratio on (1) is the honest "fraction" test; (2) reported alongside.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const resultsDir = arg('--results', join(here, 'results'));
const tok = (s) => Math.ceil((s || '').length / 4); // chars/4 estimate

// MCP tool-schema tax (CLI-vs-MCP finding): the brain-serve tool DEFINITIONS —
// name + description + inputSchema for brain_query/node/recipe — are advertised
// to the model at conversation start and sit RESIDENT every turn, before any
// query. Prior versions of this script counted CLAUDE.md + fetched results but
// missed this. It is a per-turn cost paid ONLY by conditions that mount the MCP
// server (pb, pb-scoped); fat/scratch pay 0. Computed the same way brain-serve
// builds the tools, so it tracks the real advertised surface (grows with the
// concept enum).
function mcpSchemaTokens() {
  try {
    const brain = JSON.parse(readFileSync(join(repo, '.claude/skills/fonderie/brain.json'), 'utf8'));
    const ids = Object.keys(brain.concepts || {}).sort();
    const menu = ids.map((id) => `  ${id} — ${brain.concepts[id].description}`).join('\n');
    const tools = [
      { name: 'brain_query',
        description: 'Fonderie SDK knowledge. Call this BEFORE writing or editing any code that touches auth, billing, orgs/teams, permissions, email, webhooks, rate limiting, or config. Pick the concept matching the task, whatever language it was phrased in. Returns the package to use, how it wires, the canonical recipe, security invariants, and the EXACT TypeScript signatures + routes — everything needed to write correct code in one shot. Do not read @fonderie source or docs — ask here.\nConcepts:\n' + menu,
        inputSchema: { type: 'object', properties: { concept: { type: 'string', enum: ids, description: 'The Fonderie capability the task needs (see tool description for what each covers)' } }, required: ['concept'] } },
      { name: 'brain_node', description: 'Full detail on one @fonderie package: version, requires, exports, tables, routes, and edges.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Package name without the @fonderie/ prefix, e.g. "auth"' } }, required: ['id'] } },
      { name: 'brain_recipe', description: 'Canonical wiring for a named recipe (e.g. "stripe-checkout", "basic-auth") plus its security invariants.', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Recipe name' } }, required: ['name'] } },
    ];
    return tok(JSON.stringify(tools));
  } catch { return 0; }
}
const MCP_TAX = mcpSchemaTokens();
const usesMcp = (cond) => cond === 'pb' || cond === 'pb-scoped';

// Pull the Fonderie knowledge the model FETCHED at runtime, on ANY transport, so
// every condition is scored identically (PLAN-SKILLS-CLI.md):
//   MCP  — tool_use named brain_query.
//   CLI  — Bash tool_use whose command runs brain-query.mjs.
//   LAZY — Read tool_use whose file_path is a lazy body (skills/fonderie/<pkg>.md
//          or the router SKILL.md pulled on demand).
// In each case the paired tool_result carries the knowledge; sum its size.
// Returns { calls, tokens (total), turns, liveTurnSum } where liveTurnSum =
// Σ over fetches of (size × turns-it-stays-in-context-after-read). Dividing that
// by turns gives the RESIDENT-AFTER-READ per-turn contribution — the fair basis:
// a fetched body/result stays cache-resident every turn from its arrival onward,
// exactly like the eager brain. (The old `tokens/turns` amortization treated a
// fetch as a one-turn cost, understating lazy conditions that read big bodies.)
function fetchedKnowledge(transcriptPath, cond) {
  if (!existsSync(transcriptPath)) return { calls: 0, tokens: 0, turns: 0, liveTurnSum: 0 };
  const ids = new Set();
  let calls = 0, tokens = 0, turnsSeen = 0;
  const arrivals = []; // { atTurn, size } — turnsSeen when the result arrived
  // Only count a fetch as MARGINAL (not already in resident K):
  //  - brain_query (MCP) / brain-query.mjs (CLI): always marginal (discovery).
  //  - a skill BODY read (fonderie/<pkg>.md): marginal ONLY for pb-lazy, whose K
  //    is the router alone. For `fat`, the bodies ARE the resident skill dir (in
  //    K) → reading one is a double-count, so NOT marginal.
  //  - the router SKILL.md: never marginal for pb-lazy (it's in K).
  const bodyRe = /skills\/fonderie\/[\w-]+\.md/;
  const routerRe = /skills\/SKILL\.md/;
  const skillRead = (s) => (/\b(cat|head|tail|less|bat)\b/.test(s) && /skills\/(fonderie\/[\w-]+\.md|SKILL\.md)/.test(s));
  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'assistant' && o.message?.usage) turnsSeen++; // count model turns in order
    const content = o.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type === 'tool_use') {
        const mcp = /brain_query/.test(b.name || '');
        const cmd = String(b.input?.command || b.input?.cmd || '');
        const path = String(b.input?.file_path || b.input?.path || '');
        const cliDiscovery = /brain-query\.mjs/.test(cmd);
        // a body read (via cat or Read), excluding the router; marginal only for lazy
        const bodyHit = (skillRead(cmd) && bodyRe.test(cmd) && !routerRe.test(cmd)) || bodyRe.test(path);
        const marginalBody = bodyHit && cond === 'pb-lazy';
        if (mcp || cliDiscovery || marginalBody) { ids.add(b.id); calls++; }
      }
      if (b.type === 'tool_result' && ids.has(b.tool_use_id)) {
        const t = typeof b.content === 'string' ? b.content
          : Array.isArray(b.content) ? b.content.map((x) => x.text || '').join('') : JSON.stringify(b.content || '');
        arrivals.push({ atTurn: turnsSeen, size: tok(t) });
        tokens += tok(t);
      }
    }
  }
  const turns = Math.max(turnsSeen, 1);
  // each fetch stays resident for (turns - atTurn) turns after it arrives
  const liveTurnSum = arrivals.reduce((s, a) => s + a.size * Math.max(0, turns - a.atTurn), 0);
  return { calls, tokens, turns, liveTurnSum };
}

// Sum real per-turn throughput from the assistant records' usage (ground truth).
function realUsage(transcriptPath) {
  if (!existsSync(transcriptPath)) return null;
  let turns = 0, input = 0, cacheRead = 0, cacheCreate = 0, output = 0;
  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const u = o.type === 'assistant' ? o.message?.usage : null;
    if (!u) continue;
    turns++;
    input += u.input_tokens || 0;
    cacheRead += u.cache_read_input_tokens || 0;
    cacheCreate += u.cache_creation_input_tokens || 0;
    output += u.output_tokens || 0;
  }
  return { turns, input, cacheRead, cacheCreate, output };
}

// --- load sessions ----------------------------------------------------------
const rows = [];
for (const f of readdirSync(resultsDir)) {
  if (!f.endsWith('.meta.json')) continue;
  const id = f.replace('.meta.json', '');
  const meta = JSON.parse(readFileSync(join(resultsDir, f), 'utf8'));
  const tr = join(resultsDir, `${id}.transcript.jsonl`);
  const fetched = fetchedKnowledge(tr, meta.cond);
  const usage = realUsage(tr) || { turns: meta.turns || 0 };
  const turns = usage.turns || 1;
  const K = meta.k_tokens ?? (meta.cond === 'scratch' ? 0 : null);
  const mcp = usesMcp(meta.cond) ? MCP_TAX : 0; // resident MCP tool-schema tax
  // Per-turn Fonderie-knowledge footprint. Two models, reported as a range:
  //   perTurnAmort  = K + mcp + fetched_total/turns   (fetch = one-turn cost; floor)
  //   perTurn (R-A-R) = K + mcp + liveTurnSum/turns   (fetch stays resident after
  //                     read, like the eager brain — the FAIR primary basis)
  const perTurnAmort = K == null ? null : K + mcp + fetched.tokens / turns;
  const perTurn = K == null ? null : K + mcp + fetched.liveTurnSum / turns;
  rows.push({ id, cond: meta.cond, session: meta.session, turns, K, mcp, fetchedTok: fetched.tokens, fetchedCalls: fetched.calls, perTurn, perTurnAmort, wallS: meta.wall_s ?? null, quality: meta.checklist_pass != null ? `${meta.checklist_pass}/${meta.checklist_total}` : '—' });
}
rows.sort((a, b) => a.cond.localeCompare(b.cond) || a.session - b.session);

// --- report -----------------------------------------------------------------
const pad = (s, n) => String(s ?? '').padEnd(n);
const padL = (s, n) => String(s ?? '').padStart(n);
console.log(`\n=== Per-session Fonderie-knowledge footprint (transcript-measured) ===`);
console.log(`(MCP tool-schema tax = ${MCP_TAX} tok, resident every turn for pb/pb-scoped; 0 for fat/scratch)`);
console.log([pad('id', 16), padL('turns', 6), padL('resident_K', 11), padL('mcp', 5), padL('fetched', 8), padL('bq', 4), padL('perTurn_K', 10), pad(' qual', 6)].join(' '));
for (const r of rows) {
  console.log([pad(r.id, 16), padL(r.turns, 6), padL(r.K ?? '—', 11), padL(r.mcp, 5), padL(r.fetchedTok, 8), padL(r.fetchedCalls, 4), padL(r.perTurn != null ? Math.round(r.perTurn) : '—', 10), pad(' ' + r.quality, 6)].join(' '));
}

// per-turn footprint by condition — reported as a RANGE (fair):
//   R-A-R (primary): a fetched body stays resident every turn after read, like
//     the eager brain. Amortized (floor): fetch = one-turn cost.
const conds = [...new Set(rows.map((r) => r.cond))];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const rar = {}, amort = {};
console.log('\n=== Turn-NEUTRAL knowledge footprint (mean per-turn tokens) ===');
console.log('  cond        resident-after-read   amortized (floor)');
for (const c of conds) {
  rar[c] = mean(rows.filter((r) => r.cond === c && r.perTurn != null).map((r) => r.perTurn));
  amort[c] = mean(rows.filter((r) => r.cond === c && r.perTurnAmort != null).map((r) => r.perTurnAmort));
  if (rar[c] != null) console.log(`  ${pad(c, 10)} ${padL(Math.round(rar[c]).toLocaleString(), 14)}   ${padL(Math.round(amort[c]).toLocaleString(), 12)}`);
}
if (rar.fat > 0) {
  const band = (r) => r <= 1 / 3 ? 'FRACTION (≤⅓)' : r < 1 ? 'parity-plus (⅓–1×)' : 'kill (≥1×)';
  console.log('  ratios vs fat (resident-after-read = the fair primary):');
  for (const c of conds.filter((x) => x !== 'fat' && x !== 'scratch')) {
    if (rar[c] != null) console.log(`  → ${pad(c, 10)} ${(rar[c] / rar.fat).toFixed(3)} → ${band(rar[c] / rar.fat)}   (amortized floor ${(amort[c] / amort.fat).toFixed(3)})`);
  }
}

// efficiency axis, reported SEPARATELY (not folded into knowledge overhead)
console.log('\n=== Turn count (efficiency — a separate axis, NOT knowledge overhead) ===');
for (const c of conds) {
  const t = rows.filter((r) => r.cond === c).map((r) => r.turns);
  if (t.length) console.log(`  ${pad(c, 10)} turns: ${t.join(', ')}  (mean ${Math.round(mean(t))})`);
}

// wall-clock — the SECOND axis (PLAN-SKILLS-CLI.md): CLI/lazy trade latency for
// tokens (Playwright: MCP 90s vs CLI 3-10min). Report it so a token win that
// blows up wall-clock is visible, not hidden.
console.log('\n=== Wall-clock (the second axis — tokens saved can cost latency) ===');
for (const c of conds) {
  const w = rows.filter((r) => r.cond === c && r.wallS != null).map((r) => r.wallS);
  if (w.length) console.log(`  ${pad(c, 10)} mean ${Math.round(mean(w))}s/session  (total ${Math.round(w.reduce((a, b) => a + b, 0))}s over ${w.length})`);
}

console.log('\nNote: n=1 sequence — directional. The per-turn footprint removes the');
console.log('turn-count confound that made Method A (0.10) and Method B (0.71) disagree.');
console.log('');
