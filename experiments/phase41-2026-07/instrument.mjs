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
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const resultsDir = arg('--results', join(here, 'results'));
const tok = (s) => Math.ceil((s || '').length / 4); // chars/4 estimate

// Pull the Fonderie knowledge the model FETCHED at runtime: sum the sizes of
// every brain_query tool_result. Match tool_use(id) → tool_result(tool_use_id).
function fetchedKnowledge(transcriptPath) {
  if (!existsSync(transcriptPath)) return { calls: 0, tokens: 0 };
  const brainIds = new Set();
  let calls = 0, tokens = 0;
  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const content = o.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type === 'tool_use' && /brain_query/.test(b.name || '')) { brainIds.add(b.id); calls++; }
      if (b.type === 'tool_result' && brainIds.has(b.tool_use_id)) {
        const t = typeof b.content === 'string' ? b.content
          : Array.isArray(b.content) ? b.content.map((x) => x.text || '').join('') : JSON.stringify(b.content || '');
        tokens += tok(t);
      }
    }
  }
  return { calls, tokens };
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
  const fetched = fetchedKnowledge(tr);
  const usage = realUsage(tr) || { turns: meta.turns || 0 };
  const turns = usage.turns || 1;
  const K = meta.k_tokens ?? (meta.cond === 'scratch' ? 0 : null);
  // per-turn Fonderie-knowledge footprint (turn-neutral):
  const perTurn = K == null ? null : K + fetched.tokens / turns;
  rows.push({ id, cond: meta.cond, session: meta.session, turns, K, fetchedTok: fetched.tokens, fetchedCalls: fetched.calls, perTurn, quality: meta.checklist_pass != null ? `${meta.checklist_pass}/${meta.checklist_total}` : '—' });
}
rows.sort((a, b) => a.cond.localeCompare(b.cond) || a.session - b.session);

// --- report -----------------------------------------------------------------
const pad = (s, n) => String(s ?? '').padEnd(n);
const padL = (s, n) => String(s ?? '').padStart(n);
console.log('\n=== Per-session Fonderie-knowledge footprint (transcript-measured) ===');
console.log([pad('id', 16), padL('turns', 6), padL('resident_K', 11), padL('fetched', 8), padL('bq', 4), padL('perTurn_K', 10), pad(' qual', 6)].join(' '));
for (const r of rows) {
  console.log([pad(r.id, 16), padL(r.turns, 6), padL(r.K ?? '—', 11), padL(r.fetchedTok, 8), padL(r.fetchedCalls, 4), padL(r.perTurn != null ? Math.round(r.perTurn) : '—', 10), pad(' ' + r.quality, 6)].join(' '));
}

// per-turn footprint by condition (turn-neutral) — the honest "fraction" test
const conds = [...new Set(rows.map((r) => r.cond))];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const perTurnByCond = {};
console.log('\n=== Turn-NEUTRAL knowledge footprint (mean per-turn tokens, across sessions) ===');
for (const c of conds) {
  const vals = rows.filter((r) => r.cond === c && r.perTurn != null).map((r) => r.perTurn);
  perTurnByCond[c] = mean(vals);
  if (perTurnByCond[c] != null) console.log(`  ${pad(c, 10)} ${Math.round(perTurnByCond[c]).toLocaleString()} tok/turn  (resident + fetched/turn)`);
}
if (perTurnByCond.fat > 0) {
  for (const c of conds.filter((x) => x !== 'fat' && x !== 'scratch')) {
    if (perTurnByCond[c] != null) {
      const ratio = perTurnByCond[c] / perTurnByCond.fat;
      const band = ratio <= 1 / 3 ? 'FRACTION (≤⅓)' : ratio < 1 ? 'parity-plus (⅓–1×)' : 'kill (≥1×)';
      console.log(`  → ${c}/fat = ${ratio.toFixed(3)}  → ${band}`);
    }
  }
}

// efficiency axis, reported SEPARATELY (not folded into knowledge overhead)
console.log('\n=== Turn count (efficiency — a separate axis, NOT knowledge overhead) ===');
for (const c of conds) {
  const t = rows.filter((r) => r.cond === c).map((r) => r.turns);
  if (t.length) console.log(`  ${pad(c, 10)} turns: ${t.join(', ')}  (mean ${Math.round(mean(t))})`);
}

console.log('\nNote: n=1 sequence — directional. The per-turn footprint removes the');
console.log('turn-count confound that made Method A (0.10) and Method B (0.71) disagree.');
console.log('');
