import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const ISO = `${process.env.TMPDIR || '/tmp'}/fonderie-p41`.replace('//', '/');
const src = (c, r) => {
  const d = join(ISO, `${c}-${r}`, 'src');
  if (!existsSync(d)) return '';
  return readdirSync(d).filter(f => f.endsWith('.ts')).map(f => readFileSync(join(d, f), 'utf8')).join('\n');
};
// Delegation-aware: CHECKLISTS.md rule — an item satisfied by an audited brick
// PASSES when the brick is wired (registered/mounted), because the guarantee
// lives in the brick, not the app src. So for each capability item: PASS if the
// app hand-implements it OR wires the brick that provides it.
const wired = (s, mod) => new RegExp(`@fonderie/${mod}`).test(s) && /register\(|\.use\(|mount\(|Module\(/i.test(s);
const checks = [
  ['no insecure secret fallback', s => !/(secret|jwt|key)\s*[:=][^;\n]*\|\|\s*['"][^'"]+['"]/i.test(s)],
  ['strong password hash', s => /bcrypt|argon2|scrypt/i.test(s) || wired(s, 'auth')],
  ['rate limiting', s => /rate.?limit|ratelimit|ipLimit/i.test(s) || wired(s, 'auth') || wired(s, 'rate-limit')],
  ['logout / session invalidation', s => /logout|invalidate|revoke/i.test(s) || wired(s, 'auth')],
  ['parameterized SQL (no string-built)', s => !/query\(\s*[`'"][^`'"]*\$\{/.test(s)],
  ['webhook signature verify', s => /constructEvent|verifySignature|webhookSecret|signature/i.test(s) || wired(s, 'billing')],
  ['audit logging', s => /audit/i.test(s) || wired(s, 'audit')],
  ['input validation', s => /\.(parse|safeParse)\(|zod|validate|typeof .* !==/i.test(s) || wired(s, 'auth')],
];
const conds = ['fat', 'pb', 'scratch'];
const agg = {};
console.log('seq'.padEnd(12), checks.map((_, i) => `c${i + 1}`).join(' '), ' /8   (delegation-aware)');
for (const c of conds) {
  agg[c] = [];
  for (const r of [1, 2, 3]) {
    const s = src(c, r);
    if (!s) { console.log(`${c}-${r}`.padEnd(12), '(no tree)'); continue; }
    const res = checks.map(([, fn]) => fn(s));
    agg[c].push(res.filter(Boolean).length);
    console.log(`${c}-${r}`.padEnd(12), res.map(b => b ? ' ✓' : ' ✗').join(' '), ` ${res.filter(Boolean).length}/8`);
  }
}
console.log('\nmean /8:');
for (const c of conds) { const a = agg[c]; if (a.length) console.log(`  ${c.padEnd(8)} ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2)}`); }
