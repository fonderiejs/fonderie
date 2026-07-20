#!/usr/bin/env node
// Harvest REAL candidate phrasings for the R2 corpus from your own Claude Code
// session transcripts (~/.claude/projects/**/*.jsonl). The "user" in R2 is a
// developer asking an assistant to wire a backend capability — those requests,
// typed in your own words, are the most authentic pre-launch source we have.
//
// This script PROPOSES; a human DISPOSES. It writes candidates.tsv with a
// suggested concept, but nothing becomes a `real` corpus row until you review
// it and move it into corpus.tsv by hand. That review step is what keeps the
// gate honest (R4): extraction can't launder generated text into "real".
//
// Integrity filters:
//  - human-typed only (origin.kind==human, string content, promptSource typed)
//  - EXCLUDES experiment run dirs — those transcripts hold the GENERATED
//    experiment prompts (gen data); harvesting them would recontaminate the
//    corpus with the very thing `real` is meant to replace.
//  - relevance prefilter via the curated alias terms (brain-knowledge.json)
//  - dedup, length cap (skip pasted walls of text — not phrasings)
//
//   node extract-phrasings.mjs [--projects <dir>] > candidates.tsv

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const projectsDir = arg('--projects', join(homedir(), '.claude', 'projects'));

// alias term -> package, from the curated R2 layer (same source the brain uses).
// Drop terms that are ordinary English words — they wreck precision ("can we…",
// "log in with another account" [a Claude account, not the auth feature]). The
// prefilter only reduces noise for human review; a dropped term at worst means
// a real phrasing needs manual add, which review already allows.
const AMBIGUOUS = new Set([
  'can', 'cannot', 'plan', 'plans', 'account', 'accounts', 'tier', 'session',
  'group', 'policy', 'grant', 'flag', 'toggle', 'register', 'protect', 'share',
  'price', 'seat', 'member', 'members', 'can', 'contact',
]);
const knowledge = JSON.parse(readFileSync(join(repo, '.claude/skills/fonderie/brain-knowledge.json'), 'utf8'));
const termToPkg = [];
for (const [pkg, terms] of Object.entries(knowledge.aliases || {}))
  for (const t of terms) {
    const term = t.toLowerCase();
    if (AMBIGUOUS.has(term)) continue;
    // word-boundary matcher so "invoice" doesn't fire on "invoiced-ness" noise
    // and multi-word aliases still match as phrases
    termToPkg.push([pkg, new RegExp(`(?:^|\\W)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\W)`, 'i')]);
  }
// package -> its concept IDs (what a human would choose between)
const pkgToConcepts = {};
for (const [id, c] of Object.entries(knowledge.concepts || {}))
  (pkgToConcepts[c.package] ||= []).push(id);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

// A transcript path is an "experiment run" if it sits under an experiments/
// tree — those prompts are generated, not real. Exclude them wholesale.
const isExperiment = (p) => /(^|\/)experiments(\/|-)/.test(p);

function humanPrompts(file) {
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== 'user') continue;
    if (o.origin?.kind !== 'human') continue;        // skip tool results / synthetic
    if (o.promptSource && o.promptSource !== 'typed') continue;
    const c = o.message?.content;
    if (typeof c !== 'string') continue;             // array content = tool_result
    const text = c.trim();
    if (!text || text.length > 240) continue;        // walls of pasted text aren't phrasings
    if (text.startsWith('/') || text.startsWith('!')) continue; // slash/bang commands
    out.push(text);
  }
  return out;
}

const seen = new Set();
const rows = [];
for (const file of walk(projectsDir)) {
  if (isExperiment(file)) continue;
  for (const text of humanPrompts(file)) {
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    // relevance prefilter: must mention at least one curated capability term
    const pkgs = new Set();
    for (const [pkg, re] of termToPkg) if (re.test(text)) pkgs.add(pkg);
    if (!pkgs.size) continue;
    seen.add(key);
    const concepts = [...pkgs].flatMap((p) => pkgToConcepts[p] || []);
    rows.push({ concepts: concepts.join('|') || '?', phrase: text.replace(/\s+/g, ' '), source: file.replace(homedir(), '~') });
  }
}

// Output: candidate-concepts <TAB> phrase <TAB> source. Review, pick ONE
// concept, and move confirmed rows into corpus.tsv as `real`.
process.stdout.write('# candidate_concepts\tphrase\tsource  (REVIEW: pick one concept, then move to corpus.tsv as real)\n');
for (const r of rows) process.stdout.write(`${r.concepts}\t${r.phrase}\t${r.source}\n`);
process.stderr.write(`\n${rows.length} candidate phrasings from ${projectsDir} (experiment runs excluded)\n`);
