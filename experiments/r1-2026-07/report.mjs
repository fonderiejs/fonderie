#!/usr/bin/env node
// Renders the Stage 1 R1 report (BRAIN_PLAN.md Phase 2.5): arm A vs arm C
// side-by-side, Wilson CI, per-task + per-category breakdown, first-action
// distribution, and representative failure examples. Reads every
// results/*.metrics.json (each carries .id like "a-auth-1" and its metrics).
//
//   node report.mjs results/*.metrics.json

import { readFileSync } from 'node:fs';

const ms = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')));
const arm = (m) => m.id[0];
const task = (m) => m.id.slice(2).replace(/-\d+$/, '');
const cat = (m) => task(m).replace(/-.*/, '');

function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
const pct = (x) => (x * 100).toFixed(0) + '%';
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

function armStats(rows) {
  const n = rows.length;
  if (!n) return null;
  const c = (f) => rows.filter(f).length;
  const lat = rows.flatMap((r) => r.latencies_ms);
  const ci = wilson(c((r) => r.before_code), n);
  return {
    n,
    attempted: c((r) => r.attempted),
    succeeded: c((r) => r.succeeded),
    before_code: c((r) => r.before_code),
    before_code_ci: ci,
    wrong: rows.reduce((s, r) => s + r.wrong_retrievals, 0),
    missed: c((r) => r.missed_retrieval),
    unnecessary: (rows.reduce((s, r) => s + r.unnecessary_retrievals, 0) / n),
    median_latency: median(lat),
    skew: c((r) => r.version_skew_fail),
  };
}

const A = armStats(ms.filter((m) => arm(m) === 'a'));
const C = armStats(ms.filter((m) => arm(m) === 'c'));

const row = (label, a, c) => `| ${label.padEnd(21)} | ${String(a).padStart(16)} | ${String(c).padStart(12)} |`;
console.log('## R1 Stage 1 — arm A (tool only) vs arm C (hook)\n');
console.log('| Metric                | Arm A (tool only) | Arm C (hook) |');
console.log('| --------------------- | ----------------: | -----------: |');
if (A && C) {
  console.log(row('Sessions', A.n, C.n));
  console.log(row('Retrieval attempted', `${A.attempted}/${A.n}`, `${C.attempted}/${C.n}`));
  console.log(row('Retrieval succeeded', `${A.succeeded}/${A.n}`, `${C.succeeded}/${C.n}`));
  console.log(row('Retrieval before code', `${A.before_code}/${A.n} (${pct(A.before_code / A.n)})`, `${C.before_code}/${C.n} (${pct(C.before_code / C.n)})`));
  console.log(row('  95% CI (Wilson)', `${pct(A.before_code_ci[0])}–${pct(A.before_code_ci[1])}`, `${pct(C.before_code_ci[0])}–${pct(C.before_code_ci[1])}`));
  console.log(row('Wrong retrieval', A.wrong, C.wrong));
  console.log(row('Missed retrieval', `${A.missed}/${A.n}`, `${C.missed}/${C.n}`));
  console.log(row('Unnecessary (avg)', A.unnecessary.toFixed(2), C.unnecessary.toFixed(2)));
  console.log(row('Median latency (ms)', A.median_latency ?? '—', C.median_latency ?? '—'));
  console.log(row('Version-skew failures', A.skew, C.skew));
}

// gate verdict on arm A (the core R1 question)
if (A) {
  const lo = A.before_code_ci[0];
  const rate = A.before_code / A.n;
  console.log(`\n### Arm A verdict: ${pct(rate)} auto-retrieval (CI ${pct(A.before_code_ci[0])}–${pct(A.before_code_ci[1])})`);
  const band = rate >= 0.9 ? '≥90% → proceed to Phase 3' : rate >= 0.4 ? '40–89% → run Stage 2 (stub arm)' : '<40% → investigate tool discovery / naming / UX, not Phase 3';
  console.log(`Decision band: ${band}`);
}

// first-action distribution (default instinct)
console.log('\n### First action (default instinct)');
for (const armId of ['a', 'c']) {
  const rows = ms.filter((m) => arm(m) === armId);
  const dist = {};
  for (const r of rows) dist[r.first_action] = (dist[r.first_action] || 0) + 1;
  const parts = Object.entries(dist).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}:${v}`);
  console.log(`- arm ${armId}: ${parts.join(', ') || '(none)'}`);
}

// per-category (arm A)
console.log('\n### Per-category, arm A (before_code / n)');
const cats = [...new Set(ms.filter((m) => arm(m) === 'a').map(cat))].sort();
for (const cName of cats) {
  const rows = ms.filter((m) => arm(m) === 'a' && cat(m) === cName);
  console.log(`- ${cName}: ${rows.filter((r) => r.before_code).length}/${rows.length}`);
}

// per-task (arm A)
console.log('\n### Per-task, arm A');
const tasks = [...new Set(ms.filter((m) => arm(m) === 'a').map(task))].sort();
for (const tName of tasks) {
  const rows = ms.filter((m) => arm(m) === 'a' && task(m) === tName);
  console.log(`- ${tName}: before_code ${rows.filter((r) => r.before_code).length}/${rows.length}, missed ${rows.filter((r) => r.missed_retrieval).length}/${rows.length}`);
}

// representative failures (arm A, before_code=false)
console.log('\n### Representative failures (arm A, no retrieval before code)');
const fails = ms.filter((m) => arm(m) === 'a' && !m.before_code).slice(0, 5);
for (const f of fails) console.log(`- ${f.id}: first_action=${f.first_action}, attempted=${f.attempted}, n_brain_calls=${f.n_brain_calls}`);
