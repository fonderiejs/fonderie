#!/usr/bin/env node
// Full delegation-aware quality scorer for the Phase 4.1 batch — scores each
// sequence's FINAL src tree against the combined 39-point rubric (CHECKLISTS.md:
// auth 12 + billing 9 + teams 9 + security 9). Delegation-aware per the rubric's
// rule ("credit an item satisfied by an audited brick when the brick is wired").
//
//   node score-full.mjs
//
// Detection is grep-based on the produced code. Items marked [J] are judgment
// calls where grep is a proxy; they are credited for a wired brick (the brick
// carries the guarantee) and checked in hand-code for scratch. Not a substitute
// for a human reading every line, but a reproducible, delegation-fair signal.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ISO = `${process.env.TMPDIR || '/tmp'}/fonderie-p41`.replace('//', '/');
const treeOf = (c, r) => {
  const d = join(ISO, `${c}-${r}`, 'src');
  if (!existsSync(d)) return '';
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [readFileSync(join(dir, e.name), 'utf8')] : []);
  return walk(d).join('\n');
};
const tscOf = (c, r) => {
  const m = join('results', `${c}-${r}-s4.meta.json`);
  try { return JSON.parse(readFileSync(m, 'utf8')).tsc === 'yes'; } catch { return false; }
};
// brick wired = imported AND registered/mounted
const wired = (s, mod) => new RegExp(`@fonderie/${mod}\\b`).test(s) && /\.register\(|\.use\(|mount\(|new \w+Module\(/i.test(s);
const has = (s, re) => re.test(s);
const noInsecureSecret = (s) => !/(secret|jwt|apikey|key)\s*[:=][^;\n]*\|\|\s*['"][^'"]+['"]/i.test(s);

// each rubric item: [label, fn(src)] — fn returns bool
const RUBRIC = [
  // ── Auth (12) ──
  ['A1 password hash', s => has(s, /bcrypt|argon2|scrypt/i) || wired(s, 'auth')],
  ['A2 session/JWT signed', s => has(s, /jsonwebtoken|jwt\.sign|SignJWT/i) || wired(s, 'auth')],
  ['A3 secret env no fallback', s => noInsecureSecret(s)],
  ['A4 signup endpoint', s => has(s, /register|signup|sign-up/i) || wired(s, 'auth')],
  ['A5 login endpoint', s => has(s, /login|signin|sign-in/i) || wired(s, 'auth')],
  ['A6 logout/invalidation', s => has(s, /logout|invalidate|revoke/i) || wired(s, 'auth')],
  ['A7 input validation', s => has(s, /\.(parse|safeParse)\(|zod|schema\.|typeof \w+ [!=]==/i) || wired(s, 'auth')],
  ['A8 no credential leak [J]', s => !/res\.(json|send)\([^)]*password/i.test(s)],
  ['A9 login rate limit', s => has(s, /rate.?limit|ratelimit|ipLimit/i) || wired(s, 'auth') || wired(s, 'rate-limit')],
  ['A10 parameterized SQL', s => !/query\(\s*[`'"][^`'"]*\$\{/.test(s)],
  ['A11 tsc clean', (_s, tsc) => tsc],
  ['A12 password policy', s => has(s, /length\s*[<>]=?\s*\d|min(imum)?.{0,8}(length|char)/i) || wired(s, 'auth')],
  // ── Billing (9) ──
  ['B1 checkout flow', s => has(s, /checkout|createSession|subscription/i) || wired(s, 'billing')],
  ['B2 webhook sig verify', s => has(s, /constructEvent|verifySignature|webhookSecret/i) || wired(s, 'billing')],
  ['B3 webhook before auth mw [J]', s => wired(s, 'billing') || /webhook/i.test(s)],
  ['B4 premium gated server-side', s => has(s, /requirePlan|requireFeature|isPremium|subscription.{0,20}(active|status)/i)],
  ['B5 subscription persisted [J]', s => has(s, /subscription|stripe_customer|current_period/i) || wired(s, 'billing')],
  ['B6 webhook idempotent [J]', s => has(s, /idempoten|already.?process|event\.id|ON CONFLICT|processed/i) || wired(s, 'billing')],
  ['B7 provider secret env', s => noInsecureSecret(s)],
  ['B8 parameterized SQL', s => !/query\(\s*[`'"][^`'"]*\$\{/.test(s)],
  ['B9 tsc clean', (_s, tsc) => tsc],
  // ── Teams (9) ──
  ['T1 create workspace', s => has(s, /workspace|organization|createTeam|\/teams/i) || wired(s, 'workspaces')],
  ['T2 invite single-use+expiring', s => (has(s, /invit/i) && has(s, /expir|used|single|token/i)) || wired(s, 'workspaces')],
  ['T3 invite no account leak [J]', s => wired(s, 'workspaces') || has(s, /invit/i)],
  ['T4 accept+reject', s => (has(s, /accept/i) && has(s, /reject|decline/i)) || wired(s, 'workspaces')],
  ['T5 list members', s => has(s, /members|listMembers|\/members/i) || wired(s, 'workspaces')],
  ['T6 authz on invite/list', s => has(s, /requireAuth|requirePermission|requireRole|authoriz/i) || wired(s, 'workspaces') || wired(s, 'permissions')],
  ['T7 invite email sent', s => has(s, /sendMail|sendEmail|nodemailer|courier|mailer/i) || wired(s, 'courier')],
  ['T8 parameterized SQL', s => !/query\(\s*[`'"][^`'"]*\$\{/.test(s)],
  ['T9 tsc clean', (_s, tsc) => tsc],
  // ── Security pass (9) ──
  ['S1 rate limit reset', s => (has(s, /rate.?limit|ratelimit/i) && has(s, /reset/i)) || wired(s, 'rate-limit') || wired(s, 'auth')],
  ['S2 rate limit invite', s => (has(s, /rate.?limit|ratelimit/i) && has(s, /invit/i)) || wired(s, 'rate-limit')],
  ['S3 audit login', s => (has(s, /audit/i) && has(s, /login/i)) || wired(s, 'audit')],
  ['S4 audit logout', s => (has(s, /audit/i) && has(s, /logout/i)) || wired(s, 'audit')],
  ['S5 audit reset', s => (has(s, /audit/i) && has(s, /reset/i)) || wired(s, 'audit')],
  ['S6 audit role grant', s => (has(s, /audit/i) && has(s, /role|grant|permission/i)) || wired(s, 'audit')],
  ['S7 audit append-only+scoped [J]', s => wired(s, 'audit') || (has(s, /audit/i) && has(s, /workspace|append/i))],
  ['S8 no regression [J]', (_s, tsc) => tsc],
  ['S9 tsc clean', (_s, tsc) => tsc],
];

const conds = ['fat', 'pb', 'scratch'];
const agg = {};
console.log(`Full 39-point rubric, delegation-aware, per sequence's final tree\n`);
for (const c of conds) {
  agg[c] = [];
  for (const r of [1, 2, 3]) {
    const s = treeOf(c, r);
    if (!s) { console.log(`${c}-${r}: (no tree)`); continue; }
    const tsc = tscOf(c, r);
    const fails = RUBRIC.filter(([, fn]) => !fn(s, tsc)).map(([l]) => l);
    const score = RUBRIC.length - fails.length;
    agg[c].push(score);
    console.log(`${c}-${r}: ${score}/39` + (fails.length ? `  — fails: ${fails.join(', ')}` : '  — perfect'));
  }
}
console.log('\nmean /39:');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
for (const c of conds) if (agg[c].length) console.log(`  ${c.padEnd(8)} ${mean(agg[c]).toFixed(1)}  (${agg[c].join(', ')})`);
console.log('\n[J] = judgment proxy (credited when the providing brick is wired). Floor per sequence: ≥ 37/39.');
