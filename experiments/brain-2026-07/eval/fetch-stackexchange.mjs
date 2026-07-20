#!/usr/bin/env node
// Harvest candidate REAL phrasings for the R2 corpus from Stack Overflow.
// Real devs ask "How do I add authentication to my SaaS?" etc.; question TITLES
// are naive phrasings. Unlike Reddit, Stack Exchange content is CC BY-SA and
// has an official, keyless API — legitimately reusable, no ToS gray area.
//
// PROPOSES, doesn't dispose: writes candidates for review. Nothing becomes a
// `real` corpus row until a human picks a concept and moves it into corpus.tsv
// (source flag `forum`). That review is the R4 firewall against laundering.
//
//   node fetch-stackexchange.mjs > candidates-se.tsv
//
// No API key needed at this volume (keyless quota ~300 req/day/IP; we make ~15).
// Optional STACKEXCHANGE_KEY raises the quota if you have one.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const KEY = process.env.STACKEXCHANGE_KEY;

// One seed query per concept area — kept generic so the returned TITLES, not
// our words, supply the phrasing. `intitle` matches the question title.
const QUERIES = [
  'add authentication', 'oauth login', 'protect route authentication',
  'multi tenant', 'invite team members', 'organizations workspaces',
  'stripe subscription', 'per seat billing', 'gate feature by plan',
  'roles and permissions', 'send transactional email', 'stripe webhook',
  'rate limiting api', 'feature flags', 'audit log',
];

// concept suggestion via the curated alias layer (same source the brain uses)
const knowledge = JSON.parse(readFileSync(join(repo, '.claude/skills/fonderie/brain-knowledge.json'), 'utf8'));
const AMBIGUOUS = new Set(['can', 'plan', 'plans', 'account', 'tier', 'session', 'group', 'policy', 'grant', 'flag', 'share', 'price', 'seat', 'member', 'members', 'contact', 'register', 'protect', 'toggle']);
const termRes = [];
for (const [pkg, terms] of Object.entries(knowledge.aliases || {}))
  for (const t of terms) {
    const term = t.toLowerCase();
    if (AMBIGUOUS.has(term)) continue;
    termRes.push([pkg, new RegExp(`(?:^|\\W)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\W)`, 'i')]);
  }
const pkgToConcepts = {};
for (const [id, c] of Object.entries(knowledge.concepts || {})) (pkgToConcepts[c.package] ||= []).push(id);
const suggest = (text) => {
  const pkgs = new Set();
  for (const [pkg, re] of termRes) if (re.test(text)) pkgs.add(pkg);
  return [...pkgs].flatMap((p) => pkgToConcepts[p] || []).join('|') || '?';
};

// decode the handful of HTML entities SE puts in titles
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function search(q) {
  // full-text `q` + relevance works; `intitle` is silently ignored by this
  // endpoint (returns the site's top questions regardless). Verified 2026-07-20.
  const p = new URLSearchParams({ site: 'stackoverflow', q, sort: 'relevance', order: 'desc', pagesize: '25', filter: 'default' });
  if (KEY) p.set('key', KEY);
  const r = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${p}`, { headers: { 'User-Agent': 'fonderie-corpus/0.1' } });
  if (!r.ok) { console.error(`  "${q}" → ${r.status}`); return { items: [], backoff: 0 }; }
  const j = await r.json();
  return { items: j.items ?? [], backoff: j.backoff ?? 0 };
}

const seen = new Set();
const rows = [];
for (const q of QUERIES) {
  const { items, backoff } = await search(q);
  for (const it of items) {
    const title = unesc((it.title || '').replace(/\s+/g, ' ').trim());
    if (title.length < 12 || title.length > 200) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ concepts: suggest(title), phrase: title, source: `stackoverflow ${it.link}` });
  }
  await sleep(Math.max(backoff * 1000, 300)); // honor SE backoff, else be polite
}

process.stdout.write('# candidate_concepts\tphrase\tsource  (REVIEW: pick one concept, then move to corpus.tsv as real, source flag `forum`)\n');
for (const r of rows) process.stdout.write(`${r.concepts}\t${r.phrase}\t${r.source}\n`);
process.stderr.write(`\n${rows.length} candidate titles from Stack Overflow — REVIEW before promoting to corpus.tsv\n`);
