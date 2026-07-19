#!/usr/bin/env node
// Behavioral drift reader (Phase-beyond-3). Reads ledger.jsonl and renders the
// tracked signals over time so a human can see trends. Pure function of the
// ledger — no model calls, deterministic, safe to run anywhere/anytime.
//
//   node drift.mjs
//
// It FLAGS movement past informational bands (see OBSERVABILITY.md) but never
// exits non-zero: this is a signal to investigate, not a pass/fail gate. A flag
// means "look", not "block". Interpreting a flag = locating a boundary of
// validity (which model/env changed?), not declaring the architecture wrong.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ledgerPath = join(here, 'ledger.jsonl');

// informational bands (movement past these = investigate, not fail)
const BANDS = {
  before_code_stub_min: 0.8, // arm-B before-code dropping below 0.8 is worth a look
  delta_min: 0.2, // Δ collapsing under the "prefer stub" threshold
  median_latency_max_ms: 200, // retrieval UX budget
};

if (!existsSync(ledgerPath)) {
  console.error('no ledger.jsonl yet — seed it with `node observe.mjs record`');
  process.exit(2);
}
const rows = readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

const pct = (x) => (x == null ? '—' : (x * 100).toFixed(0) + '%');
const arrow = (prev, cur) => (prev == null || cur == null ? '' : cur > prev ? ' ↑' : cur < prev ? ' ↓' : ' =');

console.log(`# Behavioral observability — ${rows.length} ledger entr${rows.length === 1 ? 'y' : 'ies'}\n`);
console.log('| date | model | core | P(bc\\|tool) | P(bc\\|stub) | Δ | med latency | arm-B first-action |');
console.log('| --- | --- | --- | ---: | ---: | ---: | ---: | --- |');
let prev = null;
for (const r of rows) {
  const a = r.arm_a_tool, b = r.arm_b_stub;
  const core = r.sdk_versions?.core ?? '—';
  const fa = b?.first_action_dist ? Object.entries(b.first_action_dist).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}:${v}`).join(' ') : '—';
  console.log(
    `| ${r.recorded_at} | ${r.model} | ${core} | ${pct(a?.before_code_rate)} | ${pct(b?.before_code_rate)}${arrow(prev?.arm_b_stub?.before_code_rate, b?.before_code_rate)} | ${r.delta_before_code == null ? '—' : (r.delta_before_code >= 0 ? '+' : '') + pct(r.delta_before_code)} | ${b?.median_latency_ms ?? '—'}ms | ${fa} |`,
  );
  prev = r;
}

// flags on the latest entry (investigate, don't gate)
const latest = rows[rows.length - 1];
const flags = [];
const bStub = latest.arm_b_stub?.before_code_rate;
if (bStub != null && bStub < BANDS.before_code_stub_min)
  flags.push(`P(before-code | stub) = ${pct(bStub)} < ${pct(BANDS.before_code_stub_min)} band — investigate boundary (model? env? instruction surface?)`);
if (latest.delta_before_code != null && latest.delta_before_code < BANDS.delta_min)
  flags.push(`Δ = ${pct(latest.delta_before_code)} < ${pct(BANDS.delta_min)} band — stub advantage narrowing`);
const lat = latest.arm_b_stub?.median_latency_ms;
if (lat != null && lat > BANDS.median_latency_max_ms)
  flags.push(`median latency ${lat}ms > ${BANDS.median_latency_max_ms}ms band`);

console.log(`\n## Flags on latest entry (${latest.recorded_at}) — investigate, not gate`);
console.log(flags.length ? flags.map((f) => `- ⚠ ${f}`).join('\n') : '- none — signals within informational bands');
// always exit 0: observability never blocks
