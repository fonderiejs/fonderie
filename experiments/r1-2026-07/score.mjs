#!/usr/bin/env node
// R1 scorer (BRAIN_PLAN.md Phase 2.5). Fuses a Claude Code session JSON
// transcript with the brain-server and hook logs into the retrieval-value
// metrics table, per session and aggregated per arm.
//
//   node score.mjs results/<id>.transcript.jsonl results/<id>.brain.log results/<id>.hook.log <expect-csv>
//   node score.mjs --aggregate results/*.metrics.json
//
// Emits one <id>.metrics.json per session; --aggregate rolls them up + checks
// the hard gate.

import { readFileSync, existsSync } from 'node:fs';

const GATE = {
  auto_retrieval_rate: 0.9,      // ≥90% of sessions call brain_query before Fonderie code
  max_unnecessary_per_session: 1, // ≤1 unnecessary retrieval/session (avg)
  median_latency_ms: 200,        // median lookup < 200ms
  version_skew_failures: 0,      // zero version-skew failures
};

// Extract the ordered tool-use sequence from the on-disk transcript JSONL
// (the --output-format json summary has NO tool history; the runner copies the
// real transcript to <id>.transcript.jsonl).
function toolSequence(transcriptPath) {
  const seq = [];
  if (!existsSync(transcriptPath)) return seq;
  for (const line of readFileSync(transcriptPath, 'utf8').trim().split('\n')) {
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    const content = j.message?.content ?? j.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) if (b.type === 'tool_use') seq.push({ name: b.name, input: b.input || {} });
  }
  return seq;
}

// a real brain_query tool call (the MCP tool name is namespaced by the client)
const isBrainQuery = (n) => /brain_query/.test(n);
// a Fonderie read: the model reaching for source/docs instead of the brain
const isFonderieRead = (t) => {
  if (!/^(Read|Grep|Glob)$/.test(t.name)) return false;
  return /@fonderie|fonderie/i.test(JSON.stringify(t.input));
};
// Fonderie code being written — via Write/Edit OR a Bash heredoc (the model
// often writes files with `cat > file <<EOF ... @fonderie ...`).
const isFonderieEdit = (t) => {
  if (!/^(Edit|Write|MultiEdit|Bash)$/.test(t.name)) return false;
  return /@fonderie/.test(JSON.stringify(t.input));
};

function scoreSession(transcriptPath, brainLogPath, hookLogPath, expect) {
  const seq = toolSequence(transcriptPath);
  const brainCalls = existsSync(brainLogPath)
    ? readFileSync(brainLogPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const hookLog = existsSync(hookLogPath)
    ? readFileSync(hookLogPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

  const firstBrainIdx = seq.findIndex((t) => isBrainQuery(t.name));
  const firstFonderieEditIdx = seq.findIndex(isFonderieEdit);

  const attempted = brainCalls.length > 0 || firstBrainIdx >= 0;
  const succeeded = brainCalls.some((c) => c.matched);
  // "before code": a brain_query occurred before the first Fonderie-touching edit
  const beforeCode =
    firstBrainIdx >= 0 && (firstFonderieEditIdx < 0 || firstBrainIdx < firstFonderieEditIdx);
  // wrong retrieval: a matched query whose returned packages (top) include none
  // of the expected packages. Falls back to arg text if top wasn't logged.
  const wrong = brainCalls.filter((c) => {
    if (!c.matched || !expect.length) return false;
    const got = Array.isArray(c.top) ? c.top : String(c.arg || '').split(/\W+/);
    return !expect.some((e) => got.includes(e));
  }).length;
  // missed retrieval: the model reached for Fonderie knowledge WITHOUT the brain —
  // it read @fonderie source/docs, or wrote @fonderie code, with no brain_query
  // before it. (Hook intercepts count too, for arm c.)
  const firstFonderieReadIdx = seq.findIndex(isFonderieRead);
  const hookMisses = hookLog.filter((h) => h.intercepted).length;
  const reachedForSource =
    (firstFonderieEditIdx >= 0 || firstFonderieReadIdx >= 0) && firstBrainIdx < 0;
  const missed = hookMisses > 0 || reachedForSource ? 1 : 0;
  // unnecessary: brain_query calls beyond the number of expected packages
  const unnecessary = Math.max(0, brainCalls.length - Math.max(1, expect.length));
  const latencies = brainCalls.map((c) => c.latency_ms).filter((x) => typeof x === 'number');
  const versionSkewFail = brainCalls.some((c) => c.version_skew);

  return {
    id: transcriptPath.split('/').pop().replace('.transcript.jsonl', ''),
    expect,
    attempted,
    succeeded,
    before_code: beforeCode,
    wrong_retrievals: wrong,
    missed_retrieval: missed,
    unnecessary_retrievals: unnecessary,
    hook_intercepts: hookMisses,
    latencies_ms: latencies,
    version_skew_fail: versionSkewFail,
    n_brain_calls: brainCalls.length,
  };
}

// --- aggregate + gate --------------------------------------------------------
function aggregate(metricPaths) {
  const ms = metricPaths.map((p) => JSON.parse(readFileSync(p, 'utf8')));
  const n = ms.length;
  const rate = (f) => ms.filter(f).length / n;
  const allLat = ms.flatMap((m) => m.latencies_ms);
  const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
  const sum = (f) => ms.reduce((s, m) => s + f(m), 0);

  const out = {
    sessions: n,
    auto_retrieval_rate: +rate((m) => m.before_code).toFixed(3),
    attempted_rate: +rate((m) => m.attempted).toFixed(3),
    succeeded_rate: +rate((m) => m.succeeded).toFixed(3),
    changed_answer_proxy_rate: +rate((m) => m.before_code && m.succeeded).toFixed(3),
    wrong_retrieval_total: sum((m) => m.wrong_retrievals),
    missed_retrieval_rate: +rate((m) => m.missed_retrieval).toFixed(3),
    avg_unnecessary_per_session: +(sum((m) => m.unnecessary_retrievals) / n).toFixed(3),
    median_latency_ms: median(allLat),
    version_skew_failures: sum((m) => (m.version_skew_fail ? 1 : 0)),
  };
  out.gate = {
    auto_retrieval: out.auto_retrieval_rate >= GATE.auto_retrieval_rate,
    unnecessary: out.avg_unnecessary_per_session <= GATE.max_unnecessary_per_session,
    latency: out.median_latency_ms != null && out.median_latency_ms < GATE.median_latency_ms,
    version_skew: out.version_skew_failures === GATE.version_skew_failures,
  };
  out.gate.PASS = Object.values(out.gate).every(Boolean);
  return out;
}

// --- CLI ---------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv[0] === '--aggregate') {
  console.log(JSON.stringify(aggregate(argv.slice(1)), null, 2));
} else {
  const [transcriptPath, brainLog, hookLog, expectCsv] = argv;
  const expect = (expectCsv || '').split(',').filter(Boolean);
  console.log(JSON.stringify(scoreSession(transcriptPath, brainLog, hookLog, expect), null, 2));
}
