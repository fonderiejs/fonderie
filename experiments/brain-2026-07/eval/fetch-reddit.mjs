#!/usr/bin/env node
// Harvest candidate REAL phrasings from Reddit for the R2 corpus. Real people
// on r/SaaS, r/webdev, r/nextjs, … ask for these capabilities in their own
// words; post TITLES are naive phrasings ("How do I add auth to my SaaS?").
//
// Compliant path only: Reddit's OAuth API (unauthenticated .json is now blocked
// from non-browser IPs). Register a "script" app at reddit.com/prefs/apps and
// export credentials — never commit them:
//   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
//
// Like the transcript extractor, this PROPOSES; you dispose. Output is
// candidates for review — nothing is a `real` corpus row until a human picks a
// concept and moves it into corpus.tsv. That review is the R4 firewall.
//
//   node fetch-reddit.mjs > candidates-reddit.tsv
//
// Provenance for anything you keep from here: source flag `forum` — real, but a
// search/forum register, one rung below a paying client's own words (`support`).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT } = process.env;
if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
  console.error('Set REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET (script app at reddit.com/prefs/apps).');
  process.exit(2);
}
const UA = REDDIT_USER_AGENT || 'fonderie-corpus/0.1';

// Subreddits where founders/devs ask to wire backend capabilities, and the
// seed queries (kept generic so titles, not our words, supply the phrasing).
const SUBREDDITS = ['SaaS', 'webdev', 'nextjs', 'reactjs', 'node', 'Supabase', 'indiehackers', 'Entrepreneur'];
const QUERIES = [
  'add authentication', 'add login', 'oauth google login', 'protect route auth',
  'add teams organizations', 'invite members', 'multi tenant',
  'add stripe billing', 'subscription plans', 'per seat billing', 'gate feature paid plan',
  'roles permissions', 'send transactional email', 'stripe webhooks', 'rate limiting',
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

async function token() {
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`token ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function search(tok, sub, q) {
  const url = `https://oauth.reddit.com/r/${sub}/search?q=${encodeURIComponent(q)}&restrict_sr=1&sort=relevance&t=all&limit=25`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, 'User-Agent': UA } });
  if (!r.ok) { console.error(`  ${sub} "${q}" → ${r.status}`); return []; }
  return (await r.json()).data?.children?.map((c) => c.data) ?? [];
}

const tok = await token();
const seen = new Set();
const rows = [];
for (const sub of SUBREDDITS) {
  for (const q of QUERIES) {
    for (const p of await search(tok, sub, q)) {
      // titles phrased as a question/request are the naive phrasings we want
      const title = (p.title || '').replace(/\s+/g, ' ').trim();
      if (title.length < 12 || title.length > 200) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ concepts: suggest(title), phrase: title, source: `reddit r/${sub} https://reddit.com${p.permalink}` });
    }
    await sleep(1200); // be a good citizen — well under the API rate limit
  }
}

process.stdout.write('# candidate_concepts\tphrase\tsource  (REVIEW: pick one concept, then move to corpus.tsv as real, source flag `forum`)\n');
for (const r of rows) process.stdout.write(`${r.concepts}\t${r.phrase}\t${r.source}\n`);
process.stderr.write(`\n${rows.length} candidate titles from ${SUBREDDITS.length} subreddits — REVIEW before promoting to corpus.tsv\n`);
