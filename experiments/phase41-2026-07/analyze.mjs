#!/usr/bin/env node
// Phase 4.1 analysis — computes the PRE-REGISTERED metric (BRAIN_PLAN.md
// § Phase 4.1) from the raw session results and emits the locked decision.
// The rule is NOT renegotiated here; this only measures against it.
//
//   node analyze.mjs [--results <dir>]
//
// Primary question (Goal B): is the project brain's Fonderie-knowledge overhead
// per session ≤ ⅓ of the fat skill's, at equal quality (checklist ≥ 11/12),
// cumulated across the 4-session workload?
//
// ── Attribution: two independent methods, reported side by side ──────────────
// Credibility rests on the attribution being defensible, so we compute both and
// only trust a verdict when they AGREE (and enough data exists):
//
//  A. STATIC-K (deterministic, pricing-independent ratio).
//     The resident Fonderie-knowledge artifact is known: for `pb` it is
//     CLAUDE.md (always fully in context every turn — exact); for `fat` it is
//     the loaded skill dir. Overhead unit = K_tokens × num_turns (the artifact
//     is re-charged as cache_read each turn). The pb/fat RATIO is independent of
//     cache pricing (same rate cancels). K comes from meta.k_tokens (archived at
//     run time); fat falls back to the measured skill-dir size with a flag.
//
//  B. EMPIRICAL (differential vs the scratch control).
//     scratch carries zero Fonderie knowledge, so per session index:
//     knowledge_cache_read(cond) ≈ cache_read(cond) − cache_read(scratch).
//     Noisier (product code differs) but uses real usage. USD via opus rates.
//
// Guardrails (never over-claim): no verdict unless N ≥ 3 sequences per condition
// AND quality is scored AND fat+pb+scratch all present. n=1 is never a verdict
// (pre-registration). Missing pieces are reported as INSUFFICIENT, not guessed.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const resultsDir = arg('--results', join(here, 'results'));

// opus-4-8 rates, $/MTok — used ONLY for the USD readout; the Method-A ratio is
// pricing-independent. Adjust here if rates change.
const PRICE = { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 };
const usd = (tok, rate) => (tok / 1e6) * rate;

// Fallback K for `fat` when a session predates k_tokens archival: the skeleton-b
// skill dir minus brain artifacts (measured 2026-07-20 ≈ 27.8k tok). Flagged.
const FAT_K_FALLBACK = 27818;

// ── load sessions ────────────────────────────────────────────────────────────
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sessions = [];
if (existsSync(resultsDir)) {
  for (const f of readdirSync(resultsDir)) {
    if (!f.endsWith('.meta.json')) continue;
    const id = f.replace('.meta.json', '');
    const meta = j(join(resultsDir, f));
    const rp = join(resultsDir, `${id}.json`);
    if (!existsSync(rp)) continue;
    let r; try { r = j(rp); } catch { continue; }
    const u = r.usage || {};
    sessions.push({
      id, cond: meta.cond, seq: String(meta.seq), session: Number(meta.session),
      cost: r.total_cost_usd ?? null, turns: r.num_turns ?? null,
      cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0,
      input: u.input_tokens ?? 0, output: u.output_tokens ?? 0,
      loc: meta.loc ?? null, tsc: meta.tsc ?? null,
      kTokens: meta.k_tokens ?? null,
      qPass: meta.checklist_pass ?? null, qTotal: meta.checklist_total ?? null,
      // scored iff both present; belowFloor iff pass < total-1 (the ≥11/12 spirit)
      quality: meta.checklist_pass != null && meta.checklist_total != null ? `${meta.checklist_pass}/${meta.checklist_total}` : null,
      belowFloor: meta.checklist_pass != null && meta.checklist_total != null && meta.checklist_pass < meta.checklist_total - 1,
      limited: r.subtype === 'error_max_turns' || /limit/i.test(r.subtype || ''),
    });
  }
}
sessions.sort((a, b) => a.cond.localeCompare(b.cond) || a.seq.localeCompare(b.seq) || a.session - b.session);

if (!sessions.length) { console.log('No sessions in', resultsDir); process.exit(0); }

// ── raw audit table ──────────────────────────────────────────────────────────
const pad = (s, n) => String(s ?? '').padEnd(n);
const padL = (s, n) => String(s ?? '').padStart(n);
console.log('\n=== Raw sessions (audit trail) ===');
console.log([pad('id', 14), padL('turns', 6), padL('cost$', 8), padL('cacheRead', 11), padL('K_tok', 8), padL('loc', 5), pad(' tsc', 5), pad('qual', 5)].join(' '));
for (const s of sessions) {
  console.log([pad(s.id, 14), padL(s.turns, 6), padL(s.cost?.toFixed(3), 8), padL(s.cacheRead, 11), padL(s.kTokens ?? '—', 8), padL(s.loc, 5), pad(' ' + (s.tsc ?? '—'), 5), pad(s.quality ?? '—', 5)].join(' ') + (s.limited ? '  ⚠limited' : '') + (s.belowFloor ? '  ⚠below-floor' : ''));
}

// ── group + per-session-index means across sequences ─────────────────────────
const conds = [...new Set(sessions.map((s) => s.cond))];
const seqCount = (c) => new Set(sessions.filter((s) => s.cond === c).map((s) => s.seq)).size;
const bySession = (c) => {
  const m = new Map();
  for (const s of sessions.filter((x) => x.cond === c)) (m.get(s.session) || m.set(s.session, []).get(s.session)).push(s);
  return m;
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// Method A: static-K overhead unit = K × turns, per session, averaged over seqs
function staticOverhead(c) {
  const m = bySession(c);
  let total = 0, flagged = false, validK = 0, sessionsSeen = 0;
  const perSession = [];
  for (const [sess, rows] of [...m.entries()].sort((a, b) => a[0] - b[0])) {
    sessionsSeen++;
    const units = rows.map((r) => {
      let k = r.kTokens;
      if (k == null && c === 'fat') { k = FAT_K_FALLBACK; flagged = true; }
      if (k == null && c === 'scratch') k = 0; // scratch legitimately has zero knowledge
      return k == null ? null : k * (r.turns || 0);
    }).filter((x) => x != null);
    if (units.length) validK++;
    const u = mean(units);
    if (u != null) { total += u; perSession.push({ sess, unit: u }); }
  }
  // hasK: did this condition contribute ANY real K measurement? scratch is
  // trivially valid (K=0 by definition); fat/pb need archived (or fallback) K.
  const hasK = c === 'scratch' ? true : validK > 0;
  return { total, perSession, flagged, hasK, validK, sessionsSeen };
}
// A ratio is only meaningful when BOTH conditions have real K data — otherwise
// a missing-K zero would masquerade as a winning result.
const ratioOK = () => sa.pb?.hasK && sa.fat?.hasK && sa.fat.total > 0;

console.log('\n=== Method A — static-K overhead (K_tokens × turns; ratio is pricing-independent) ===');
const sa = {};
for (const c of conds) {
  sa[c] = staticOverhead(c);
  const note = c !== 'scratch' && !sa[c].hasK ? '  (⚠ K NOT ARCHIVED — cannot measure; run future sessions with the patched harness)'
    : sa[c].flagged ? '  (⚠ fat K fallback — no per-session archival)' : '';
  console.log(`  ${pad(c, 8)} cumulative overhead-units: ${Math.round(sa[c].total).toLocaleString()}${note}`);
}
if (ratioOK()) {
  const ratio = sa.pb.total / sa.fat.total;
  console.log(`  → pb / fat = ${ratio.toFixed(3)}  (USD est. pb ${usd(sa.pb.total, PRICE.cacheRead).toFixed(2)} vs fat ${usd(sa.fat.total, PRICE.cacheRead).toFixed(2)})`);
} else {
  console.log('  → pb/fat ratio: UNAVAILABLE (a condition is missing real K data — not zero, unmeasured)');
}

// Method B: empirical differential vs scratch, per session index
console.log('\n=== Method B — empirical (cache_read minus scratch control) ===');
const sb = {};
if (conds.includes('scratch')) {
  const scr = bySession('scratch');
  for (const c of conds.filter((x) => x !== 'scratch')) {
    const m = bySession(c);
    let total = 0, ok = true;
    for (const [sess, rows] of m) {
      const base = mean((scr.get(sess) || []).map((r) => r.cacheRead));
      if (base == null) { ok = false; continue; }
      total += Math.max(0, mean(rows.map((r) => r.cacheRead)) - base);
    }
    sb[c] = ok ? total : null;
    if (ok) console.log(`  ${pad(c, 8)} cumulative knowledge cache_read: ${Math.round(total).toLocaleString()} tok  (≈ $${usd(total, PRICE.cacheRead).toFixed(2)})`);
  }
  if (sb.pb != null && sb.fat && sb.fat > 0) console.log(`  → pb / fat = ${(sb.pb / sb.fat).toFixed(3)}`);
} else {
  console.log('  (no scratch control sessions yet — cannot run empirical method)');
}

// ── verdict, with guardrails ─────────────────────────────────────────────────
console.log('\n=== Decision (pre-registered rule — locked) ===');
const missing = [];
for (const c of ['fat', 'pb', 'scratch']) if (seqCount(c) < 3) missing.push(`${c}: ${seqCount(c)}/3 sequences`);
const unscored = sessions.some((s) => s.quality == null);
if (unscored) missing.push('quality (checklist) not scored — required for "equal quality"');
const belowFloor = sessions.filter((s) => s.belowFloor);
if (belowFloor.length) missing.push(`${belowFloor.length} session(s) below quality floor — cost claim invalid there: ${belowFloor.map((s) => s.id).join(', ')}`);

const rule = (r) => r <= 1 / 3 ? 'Goal B MET — ship compiler as init default; "fraction" claim earned'
  : r < 1 ? 'PARITY-PLUS — ship for freshness/selectivity; retire the "fraction" headline'
  : 'KILL RULE — cost thesis dies; claim reverts to correctness density';

if (missing.length) {
  console.log('  INSUFFICIENT DATA — no verdict. Missing:');
  for (const m of missing) console.log(`   - ${m}`);
  if (ratioOK()) console.log(`  (directional only, Method A: pb/fat = ${(sa.pb.total / sa.fat.total).toFixed(3)} → ${rule(sa.pb.total / sa.fat.total)})`);
  else console.log('  (no directional read — pb/fat K data not yet archived)');
} else {
  const rA = sa.pb.total / sa.fat.total, rB = sb.pb / sb.fat;
  console.log(`  Method A: pb/fat = ${rA.toFixed(3)} → ${rule(rA)}`);
  console.log(`  Method B: pb/fat = ${rB.toFixed(3)} → ${rule(rB)}`);
  console.log(rule(rA) === rule(rB) ? '  ✓ methods AGREE — verdict robust' : '  ✗ methods DISAGREE — instrument resident context directly before claiming');
}
console.log('');
