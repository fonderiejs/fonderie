#!/usr/bin/env node
// Record a hand-scored checklist for one session (CHECKLISTS.md). Writes
// checklist_pass / checklist_total into the run's meta.json (what analyze.mjs
// reads) and appends an audit line to SCORES.md. Keeps humans out of raw JSON.
//
//   node score.mjs <run-id> <pass>/<total> ["notes"]
//   node score.mjs pb-1-s2 8/9 "webhook handler not idempotent"

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [runId, frac, ...noteParts] = process.argv.slice(2);
const note = noteParts.join(' ');

if (!runId || !/^\d+\/\d+$/.test(frac || '')) {
  console.error('usage: node score.mjs <run-id> <pass>/<total> ["notes"]');
  process.exit(2);
}
const [pass, total] = frac.split('/').map(Number);
if (pass > total) { console.error(`pass (${pass}) > total (${total})?`); process.exit(2); }

const metaPath = join(here, 'results', `${runId}.meta.json`);
if (!existsSync(metaPath)) { console.error(`no meta for run "${runId}" at ${metaPath}`); process.exit(1); }

const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
meta.checklist_pass = pass;
meta.checklist_total = total;
if (note) meta.checklist_note = note;
writeFileSync(metaPath, JSON.stringify(meta) + '\n');

const floor = total - 1;
const verdict = pass >= floor ? 'PASS floor' : 'BELOW floor';
appendFileSync(join(here, 'SCORES.md'),
  `- \`${runId}\` (${meta.cond} seq ${meta.seq} s${meta.session}): **${pass}/${total}** — ${verdict}${note ? ` — ${note}` : ''}\n`);

console.log(`${runId}: ${pass}/${total} (floor ${floor}) → ${verdict}. meta + SCORES.md updated.`);
