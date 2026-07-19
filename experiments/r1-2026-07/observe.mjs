#!/usr/bin/env node
// Behavioral observability recorder (Phase-beyond-3). Reads the scored panel
// runs in results/ and appends ONE summary record to ledger.jsonl — a
// time-series of retrieval behavior so drift surfaces as a trend, not a single
// failing run. This is observability, NOT a gate: it records signals, it never
// exits non-zero on a "bad" number. Cadence + interpretation: OBSERVABILITY.md.
//
//   node observe.mjs record   # summarize whatever valid runs are in results/
//                             # (no model calls — used to seed and to re-record)
//
// The paid panel runs themselves are driven by observe.sh (human-initiated on
// release / major-dependency change); this file only turns their scored output
// into a ledger row.

import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(here, 'results');
const ledger = join(here, 'ledger.jsonl');
const brainPath = join(here, '..', '..', '.claude', 'skills', 'fonderie', 'brain.json');

const arm = (id) => id[0];
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
const rate = (rows, f) => (rows.length ? +(rows.filter(f).length / rows.length).toFixed(3) : null);

function loadMetrics() {
  if (!existsSync(resultsDir)) return [];
  return readdirSync(resultsDir)
    .filter((f) => /^[ab]-.*\.metrics\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(resultsDir, f), 'utf8')));
}

function armSummary(rows) {
  if (!rows.length) return null;
  const lat = rows.flatMap((r) => r.latencies_ms || []);
  const firstActions = {};
  for (const r of rows) firstActions[r.first_action] = (firstActions[r.first_action] || 0) + 1;
  return {
    n: rows.length,
    before_code_rate: rate(rows, (r) => r.before_code),
    succeeded_rate: rate(rows, (r) => r.succeeded),
    missed_rate: rate(rows, (r) => r.missed_retrieval),
    wrong_total: rows.reduce((s, r) => s + (r.wrong_retrievals || 0), 0),
    median_latency_ms: median(lat),
    first_action_dist: firstActions,
  };
}

const ms = loadMetrics();
if (!ms.length) {
  console.error('no scored runs in results/ — run the panel first (observe.sh run) then re-record');
  process.exit(2);
}

const A = armSummary(ms.filter((m) => arm(m.id) === 'a'));
const B = armSummary(ms.filter((m) => arm(m.id) === 'b'));
const brain = existsSync(brainPath) ? JSON.parse(readFileSync(brainPath, 'utf8')) : {};

const delta =
  A && B && A.before_code_rate != null && B.before_code_rate != null
    ? +(B.before_code_rate - A.before_code_rate).toFixed(3)
    : null;

const record = {
  recorded_at: new Date().toISOString().slice(0, 10),
  model: process.env.OBSERVE_MODEL || 'claude-opus-4-8',
  sdk_versions: brain.sdkVersions || null,
  arm_a_tool: A,
  arm_b_stub: B,
  delta_before_code: delta,
  note: process.argv[3] || null,
};

appendFileSync(ledger, JSON.stringify(record) + '\n');
console.log('appended ledger entry:');
console.log(JSON.stringify(record, null, 2));
