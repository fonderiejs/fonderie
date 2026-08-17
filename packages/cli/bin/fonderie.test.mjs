#!/usr/bin/env node
// Smoke test for the fonderie CLI — fabricates a fixture project with a couple of
// installed @fonderie packages (each with a co-located brain/ fragment) and
// asserts `skill` writes a router + bodies, and `query` answers correctly.
// Zero deps; exits non-zero on failure.

import { execFileSync, execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, 'fonderie.mjs');
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const run = (args, opts = {}) => execFileSync('node', [bin, ...args], { encoding: 'utf8', ...opts });

// fixture: auth (with a fragment) + billing (with a fragment) installed
const proj = mkdtempSync(join(tmpdir(), 'fonderie-cli-'));
for (const [name, ver, sig] of [['auth', '1.3.2', 'class AuthModule {}'], ['billing', '1.1.2', 'class BillingModule {}']]) {
  const d = join(proj, 'node_modules', '@fonderie', name);
  mkdirSync(join(d, 'brain'), { recursive: true });
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: `@fonderie/${name}`, version: ver }));
  writeFileSync(join(d, 'brain', 'signatures.md'), `# @fonderie/${name} — signatures\n\n${sig}\n`);
}

// --- query --concepts ---
const list = run(['query', '--concepts']);
if (!/billing\.subscriptions/.test(list)) fail('query --concepts missing billing.subscriptions');

// --- query an installed concept → returns the fragment signatures ---
const q = run(['query', 'billing.subscriptions', '--project', proj]);
if (!/@fonderie\/billing@1\.1\.2 \(installed\)/.test(q)) fail('query did not report installed billing');
if (!/class BillingModule/.test(q)) fail('query did not inline the installed fragment signatures');
if (!/Recipe:/.test(q)) fail('query missing recipe');

// --- query a NOT-installed concept → install guidance, no signatures ---
const qn = run(['query', 'workspaces.teams', '--project', proj]);
if (!/npm install @fonderie\/workspaces/.test(qn)) fail('query of uninstalled pkg missing install guidance');

// --- skill → router + per-package bodies for installed only ---
const out = join(proj, '.claude/skills');
run(['skill', '--project', proj, '--out', out]);
if (!existsSync(join(out, 'SKILL.md'))) fail('skill did not write SKILL.md');
const router = readFileSync(join(out, 'SKILL.md'), 'utf8');
if (!/name: fonderie/.test(router)) fail('router missing frontmatter');
if (!/fonderie query billing\.subscriptions/.test(router)) fail('router missing discover command');
if (!/`fonderie\/billing\.md`/.test(router)) fail('router should point to the installed billing body');
if (!/— \(not installed\)/.test(router)) fail('router should mark uninstalled concepts');
if (!existsSync(join(out, 'fonderie', 'billing.md'))) fail('missing lazy body fonderie/billing.md');
if (!existsSync(join(out, 'fonderie', 'auth.md'))) fail('missing lazy body fonderie/auth.md');
if (existsSync(join(out, 'fonderie', 'workspaces.md'))) fail('should NOT emit a body for an uninstalled package');
if (!/class BillingModule/.test(readFileSync(join(out, 'fonderie', 'billing.md'), 'utf8'))) fail('billing body missing its signatures');

// Router stays lazy: it lists one row per concept + invariants, so it grows with
// the catalog (61 concepts ≈ 5.9k tok as of 2026-08). The budget guards the lazy
// win — the router must stay well under the 6–28k eager brain it replaces, not
// that it be tiny. Bump this if the catalog legitimately grows; shrink the router
// (e.g. collapse uninstalled concepts) if it approaches the eager range.
if (Math.ceil(router.length / 4) > 8000) fail(`router too big (~${Math.ceil(router.length / 4)} tok) — lazy defeated`);

// --- init → generates the skill AND wires a fresh-keeping postinstall ---
const proj2 = mkdtempSync(join(tmpdir(), 'fonderie-init-'));
mkdirSync(join(proj2, 'node_modules', '@fonderie', 'auth', 'brain'), { recursive: true });
writeFileSync(join(proj2, 'node_modules', '@fonderie', 'auth', 'package.json'), JSON.stringify({ name: '@fonderie/auth', version: '1.3.2' }));
writeFileSync(join(proj2, 'node_modules', '@fonderie', 'auth', 'brain', 'signatures.md'), '# auth\n\nclass AuthModule {}\n');
writeFileSync(join(proj2, 'package.json'), JSON.stringify({ name: 'app', scripts: { build: 'tsc' } }));
run(['init', '--project', proj2]);
if (!existsSync(join(proj2, '.claude/skills/SKILL.md'))) fail('init did not write the skill');
const pj2 = JSON.parse(readFileSync(join(proj2, 'package.json'), 'utf8'));
if (pj2.scripts.postinstall !== 'fonderie skill') fail(`init did not wire postinstall (got: ${pj2.scripts.postinstall})`);
if (pj2.scripts.build !== 'tsc') fail('init clobbered an existing script');
// idempotent: running init again must not double-append
run(['init', '--project', proj2]);
const pj2b = JSON.parse(readFileSync(join(proj2, 'package.json'), 'utf8'));
if (pj2b.scripts.postinstall !== 'fonderie skill') fail(`init not idempotent (got: ${pj2b.scripts.postinstall})`);
// existing postinstall is chained, not clobbered
const proj3 = mkdtempSync(join(tmpdir(), 'fonderie-init2-'));
writeFileSync(join(proj3, 'package.json'), JSON.stringify({ name: 'app', scripts: { postinstall: 'patch-package' } }));
run(['init', '--project', proj3]);
const pj3 = JSON.parse(readFileSync(join(proj3, 'package.json'), 'utf8'));
if (pj3.scripts.postinstall !== 'patch-package && fonderie skill') fail(`init did not chain existing postinstall (got: ${pj3.scripts.postinstall})`);

// --- add: offline guards (the happy path installs from npm — not unit-tested) ---
// unknown capability → non-zero, lists the recipes (no network touched)
let addErr = '';
try { run(['add', 'not-a-recipe', '--project', proj]); fail('add accepted an unknown recipe'); }
catch (e) { addErr = String(e.stderr || e.stdout || ''); }
if (!/basic-auth/.test(addErr)) fail('add unknown-recipe error should list available recipes');
// help lists the add command
if (!/fonderie add <capability>/.test(run(['help']))) fail('help missing `fonderie add`');

// ── config/secret management commands (thin client over the admin API) ──────
// Uses async execFile so the in-process http fixture can respond (execFileSync
// would block the event loop and deadlock the server).
await (async () => {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, actor: req.headers['x-actor'], body: raw ? JSON.parse(raw) : undefined });
      if (req.url.includes('conflict')) {
        res.writeHead(409, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ reason: 'VERSION_CONFLICT', explanation: 'stale', details: { currentVersion: 5 } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ reason: 'OK', explanation: 'ok', result: { ok: true } }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const env = { ...process.env, FONDERIE_ADMIN_URL: `http://127.0.0.1:${port}`, FONDERIE_ADMIN_TOKEN: 'sekret', FONDERIE_ACTOR: 'ada' };
  const cli = (args) => execFileP('node', [bin, ...args], { env });

  await cli(['config', 'get']);
  await cli(['config', 'set', 'feature.x', 'true']);
  await cli(['config', 'history', 'feature.x']);
  await cli(['config', 'rollback', 'feature.x', '--to-version', '2']);
  await cli(['secret', 'reveal', 'stripe.key', '--env', 'prod']);

  const find = (m, u) => requests.find((r) => r.method === m && r.url === u);
  if (!find('GET', '/admin/config')?.auth?.includes('sekret')) fail('config get: wrong request/auth');
  const set = find('PUT', '/admin/config/feature.x');
  if (set?.body?.value !== true) fail('config set: value should parse to boolean true');
  if (set?.actor !== 'ada') fail('config set: X-Actor not sent');
  if (!find('GET', '/admin/config/feature.x/revisions')) fail('config history: wrong path');
  if (find('POST', '/admin/config/feature.x/rollback')?.body?.toVersion !== 2) fail('rollback: toVersion body wrong');
  if (!find('POST', '/admin/secrets/stripe.key/reveal?environment=prod')) fail('secret reveal: wrong path');

  // 409 conflict → exit 2 (reload + retry)
  let code = 0;
  try { await cli(['config', 'set', 'conflict', 'x']); } catch (e) { code = e.code; }
  if (code !== 2) fail(`409 conflict should exit 2, got ${code}`);

  // missing env → exit 1 with guidance
  let noEnvErr = '';
  try { await execFileP('node', [bin, 'config', 'get'], { env: { ...process.env, FONDERIE_ADMIN_URL: '', FONDERIE_ADMIN_TOKEN: '' } }); }
  catch (e) { noEnvErr = String(e.stderr || ''); }
  if (!/FONDERIE_ADMIN_URL/.test(noEnvErr)) fail('missing-env should hint FONDERIE_ADMIN_URL');

  server.close();
  console.log('  ✓ config/secret management commands (get/set/history/rollback/reveal, 409→exit2, env guard)');
})();

console.log('fonderie CLI test: all assertions passed (skill, query installed/uninstalled, init wires idempotent fresh-keeping postinstall, add guards, config/secret management)');
