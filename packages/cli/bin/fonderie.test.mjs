#!/usr/bin/env node
// Smoke test for the fonderie CLI — fabricates a fixture project with a couple of
// installed @fonderie packages (each with a co-located brain/ fragment) and
// asserts `skill` writes a router + bodies, and `query` answers correctly.
// Zero deps; exits non-zero on failure.

import { execFileSync, execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
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

// --- migrate: the guard that needs no database ---
// Without DATABASE_URL it must refuse AND point at --dry-run. It must NOT
// demand a session/direct url: --status and --check only read which migrations
// are applied, so a transaction pooler is fine. That guidance was wrong here
// first time round, and a wrong warning is worse than none — it sends people
// provisioning a second credential they do not need.
let migErr = '';
try {
  run(['migrate', '--status'], { env: { ...process.env, DATABASE_URL: '' } });
  fail('migrate ran without DATABASE_URL');
} catch (e) { migErr = String(e.stderr || e.stdout || ''); }
if (!/DATABASE_URL/.test(migErr)) fail('migrate should name DATABASE_URL when it is unset');
if (!/dry-run/.test(migErr)) fail('migrate should point at --dry-run when there is no database');
if (/must be the SESSION|never the transaction pooler/i.test(migErr))
  fail('migrate must not demand session/direct — --status and --check only read');
if (!/fonderie migrate/.test(run(['help']))) fail('help missing `fonderie migrate`');

// An unreachable database must FAIL, not pass as a fresh install. Everything
// downstream swallows errors by design — pending() catches its own read failure
// and returns every file — so without the connectivity probe a refused
// connection reads as "61 pending, first-time setup, nothing to lose" and exits
// 0: a gate green precisely because it reached nothing. Port 59999 has nothing
// listening on it.
// --project is the repo root explicitly: under turbo this runs with cwd
// packages/cli, where @fonderie/store is not installed, and the command would
// exit on resolution before ever reaching the probe. Passing cwd implicitly
// made this pass standalone and fail in the suite.
const repoRoot = join(here, '..', '..', '..');
let unreachable = 0;
let unreachableErr = '';
try {
  run(['migrate', '--check', '--project', repoRoot], {
    env: { ...process.env, DATABASE_URL: 'postgresql://n:n@127.0.0.1:59999/x' },
  });
  fail('migrate --check passed against an unreachable database');
} catch (e) { unreachable = e.status; unreachableErr = String(e.stderr || e.stdout || ''); }
if (unreachable !== 1) fail(`unreachable database should exit 1, got ${unreachable}`);
if (!/cannot reach/.test(unreachableErr)) fail('unreachable should say it cannot reach the database');
if (!/59999/.test(unreachableErr)) fail('unreachable should name the target it could not reach');
// The guidance must stay un-pasteable. CI masks a secret's value everywhere it
// appears in a log, including in text this tool printed — so a lowercase
// `user:pass@host:port/database` here is redacted to `***` for exactly the
// operator who pasted that placeholder into their secret, blanking the advice
// in the one case it is needed. Caps are never pasted verbatim.
if (/user:pass/.test(unreachableErr))
  fail('guidance contains a pasteable lowercase placeholder; CI will redact it for the operator who used it');
if (!/USER:PASSWORD/.test(unreachableErr))
  fail('guidance should show the connection-string shape in un-pasteable caps');

console.log('  ✓ migrate guards (DATABASE_URL required, --dry-run offered, unreachable fails loudly, guidance un-pasteable)');

// --- migrate --dry-run: discovery + classification, no database ---
// This is the path that was broken first time round. These packages are
// ESM-ONLY — exports maps carry "import" but no "require" — so
// createRequire().resolve() answers ERR_PACKAGE_PATH_NOT_EXPORTED for every
// brick, inside a catch, and the command silently discovered nothing. The fake
// brick below is deliberately shaped that way so a regression fails here.
{
  const mp = mkdtempSync(join(tmpdir(), 'fonderie-migrate-'));
  const brick = join(mp, 'node_modules', '@fonderie', 'demo');
  const sqlDir = join(brick, 'dist', 'migrations', 'sql');
  mkdirSync(sqlDir, { recursive: true });
  writeFileSync(join(mp, 'package.json'), JSON.stringify({ name: 'app', type: 'module' }));
  writeFileSync(
    join(brick, 'package.json'),
    JSON.stringify({
      name: '@fonderie/demo',
      type: 'module',
      exports: { './migrations': { types: './dist/migrations/index.d.ts', import: './dist/migrations/index.js' } },
    }),
  );
  writeFileSync(
    join(brick, 'dist', 'migrations', 'index.js'),
    `import { dirname, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nexport const getMigrationsPath = () => join(dirname(fileURLToPath(import.meta.url)), 'sql');\n`,
  );
  writeFileSync(join(sqlDir, '001_create.sql'), 'CREATE TABLE demo (id int);');
  writeFileSync(join(sqlDir, '002_drop.sql'), 'DROP TABLE demo CASCADE;');
  // The real store, so classification is the shipped one and not a stub.
  symlinkSync(join(here, '..', '..', 'store'), join(mp, 'node_modules', '@fonderie', 'store'), 'dir');

  const outDry = run(['migrate', '--dry-run', '--project', mp], { env: { ...process.env, DATABASE_URL: '' } });
  // --dry-run touches no database, so it must not claim to have checked one.
  if (/^checking /m.test(outDry)) fail('dry-run must not report a database it never opened');
  if (!/demo: 2 migration/.test(outDry)) fail('dry-run did not discover the ESM-only brick: ' + outDry);
  if (!/001_create\.sql/.test(outDry)) fail('dry-run missed the additive migration');
  if (!/✖ 002_drop\.sql\s+DESTRUCTIVE/.test(outDry)) fail('dry-run did not flag the drop: ' + outDry);
  if (!/DROP TABLE demo CASCADE/.test(outDry)) fail('dry-run should print the statement that earned the label');
  if (!/1 of the migrations found delete data/.test(outDry)) fail('dry-run summary wrong: ' + outDry);
  console.log('  ✓ migrate --dry-run (ESM-only exports discovered, drop flagged with its statement)');
}

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

  // fonderie admin <page> — the operator surface, read-only, prefix-aware
  await cli(['admin', 'manifest']);
  await cli(['admin', 'environment']);
  await cli(['admin', 'config']);
  if (requests.filter((r) => r.url === '/_admin/environment').length !== 2) fail('admin environment/config: should both read /_admin/environment');
  await cli(['admin', 'attention']);
  await cli(['admin', 'log', '--limit', '5', '--before', 'abc']);
  await execFileP('node', [bin, 'admin', 'doctor'], { env: { ...env, FONDERIE_ADMIN_PREFIX: '/ops/' } });
  if (!find('GET', '/_admin/manifest')?.auth?.includes('sekret')) fail('admin manifest: wrong request/auth');
  if (!find('GET', '/_admin')) fail('admin attention: should hit the prefix root');
  if (!find('GET', '/_admin/activity/admin-log?limit=5&before=abc')) fail('admin log: flags not forwarded');
  if (!find('GET', '/ops/doctor')) fail('admin doctor: FONDERIE_ADMIN_PREFIX not honoured');
  await cli(['admin', 'user', 'ada@example.com']);
  await cli(['admin', 'user', 'u1', 'history', '--limit', '3']);
  await cli(['admin', 'user', 'u1', 'suspend']);
  if (!find('GET', '/_admin/users?email=ada%40example.com')) fail('admin user <email>: wrong lookup path');
  if (!find('GET', '/_admin/users/u1/login-history?limit=3')) fail('admin user history: flags not forwarded');
  if (!find('POST', '/_admin/users/u1/suspend')) fail('admin user suspend: wrong request');
  await cli(['admin', 'catalog']);
  await cli(['admin', 'subscriber', 'workspace', 'w1']);
  await cli(['admin', 'subscriber', 'user', 'u1', 'ledger', '--currency', 'eur', '--limit', '7']);
  if (!find('GET', '/_admin/catalog')) fail('admin catalog: wrong path');
  if (!find('GET', '/_admin/subscriptions/workspace/w1')) fail('admin subscriber: wrong path');
  if (!find('GET', '/_admin/wallet/user/u1/ledger?currency=eur&limit=7')) fail('admin subscriber ledger: flags not forwarded');
  await cli(['admin', 'audit', '--workspace', 'w1', '--type', 'user.login', '--limit', '9']);
  if (!find('GET', '/_admin/audit?workspaceId=w1&type=user.login&limit=9')) fail('admin audit: flags not forwarded');
  await cli(['admin', 'token', 'issue', 'dashboard', '--scopes', 'read,write', '--days', '30']);
  await cli(['admin', 'token', 'revoke', 't1']);
  const iss = find('POST', '/_admin/access/tokens');
  if (!iss || iss.body?.name !== 'dashboard' || iss.body?.scopes?.join() !== 'read,write' || iss.body?.expiresInDays !== 30) fail('admin token issue: wrong body');
  if (!find('DELETE', '/_admin/access/tokens/t1')) fail('admin token revoke: wrong path');
  let badType = 0;
  try { await cli(['admin', 'subscriber', 'team', 'x']); } catch (e) { badType = e.code; }
  if (badType !== 2) fail(`admin subscriber <bad type> should exit 2, got ${badType}`);
  let needsId = 0;
  try { await cli(['admin', 'user', 'ada@example.com', 'suspend']); } catch (e) { needsId = e.code; }
  if (needsId !== 2) fail(`admin user <email> suspend should exit 2, got ${needsId}`);
  let unknown = 0;
  try { await cli(['admin', 'nope']); } catch (e) { unknown = e.code; }
  if (unknown !== 2) fail(`admin <unknown page> should exit 2, got ${unknown}`);

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

// ── config/secret export · diff · apply (kubectl-style manifests) ────────────
// A STATEFUL fake mounted the way @fonderie/admin mounts it (/_admin/*, with
// /admin/* answering 404), so apply's writes are visible to the next diff.
await (async () => {
  const { statSync } = await import('node:fs');
  const requests = [];
  const rows = {
    config: [
      { key: 'FLAG', environment: 'all', value: true, description: 'show jobs', version: 1 },
      { key: 'LIMIT', environment: 'all', value: 10, description: null, version: 4 },
      { key: 'OLD', environment: 'all', value: 'x', description: null, version: 3 },
      { key: 'FLAG', environment: 'prod', value: false, description: null, version: 7 },
    ],
    secrets: [{ key: 'API_KEY', environment: 'all', plain: 'aaaa-old-secret-value', description: null, version: 2 }],
  };
  const reply = (res, status, result, extra = {}) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ reason: status < 400 ? 'OK' : 'ERR', explanation: extra.explanation ?? 'ok', result, details: extra.details }));
  };
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : undefined;
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
      const u = new URL(req.url, 'http://x');
      if (u.pathname === '/config/public') return reply(res, 200, { values: { FLAG: true } });
      const m = /^\/(?:_admin|ops)\/(config|secrets)(?:\/([^/]+))?(?:\/(reveal))?$/.exec(u.pathname);
      if (!m) return reply(res, 404, null, { explanation: 'Not found' });
      const [, kind, rawKey, action] = m;
      const table = rows[kind];
      const envQ = u.searchParams.get('environment');
      const scope = body?.environment ?? envQ ?? 'all';
      const pub = (r) => (kind === 'secrets' ? { ...r, plain: undefined } : r);
      if (!rawKey) return reply(res, 200, table.filter((r) => !envQ || r.environment === envQ || r.environment === 'all').map(pub));
      const key = decodeURIComponent(rawKey);
      const row = table.find((r) => r.key === key && r.environment === scope);
      if (action === 'reveal') return row ? reply(res, 200, row.plain) : reply(res, 404, null);
      if (req.method === 'DELETE') {
        table.splice(table.indexOf(row), 1);
        return reply(res, 200, null);
      }
      if (req.method === 'PUT') {
        if (row && body.ifVersion !== undefined && body.ifVersion !== row.version) return reply(res, 409, null, { explanation: 'stale', details: { currentVersion: row.version } });
        const next = { key, environment: scope, description: body.description ?? row?.description ?? null, version: (row?.version ?? 0) + 1 };
        if (kind === 'secrets') next.plain = body.value; else next.value = body.value;
        if (row) table.splice(table.indexOf(row), 1, next); else table.push(next);
        return reply(res, 200, pub(next));
      }
      return reply(res, 404, null);
    });
  });
  await new Promise((r) => server.listen(0, r));
  const env = { ...process.env, FONDERIE_ADMIN_URL: `http://127.0.0.1:${server.address().port}`, FONDERIE_ADMIN_TOKEN: 'sekret', FONDERIE_ADMIN_PREFIX: '' };
  const cli = (args, extraEnv = {}) => execFileP('node', [bin, ...args], { env: { ...env, ...extraEnv } });
  const code = async (args, extraEnv) => { try { const r = await cli(args, extraEnv); return { code: 0, ...r }; } catch (e) { return { code: e.code, stdout: e.stdout, stderr: e.stderr }; } };
  const dir = mkdtempSync(join(tmpdir(), 'fonderie-manifest-'));
  const writes = () => requests.filter((r) => r.method === 'PUT' || r.method === 'DELETE');

  // export: falls back from /admin to /_admin, scopes to 'all', sorted, no version noise
  const exported = JSON.parse((await cli(['config', 'export'])).stdout);
  if (!requests.some((r) => r.url === '/admin/config') || !requests.some((r) => r.url === '/_admin/config')) fail('export: should probe /admin then fall back to /_admin');
  if (exported.kind !== 'ConfigSet' || exported.apiVersion !== 'fonderie/v1' || exported.metadata.environment !== 'all') fail('export: wrong envelope');
  if (Object.keys(exported.entries).join() !== 'FLAG,LIMIT,OLD') fail(`export: wrong keys ${Object.keys(exported.entries)}`);
  if (exported.entries.FLAG.value !== true || exported.entries.FLAG.description !== 'show jobs' || 'version' in exported.entries.FLAG) fail('export: FLAG entry wrong');
  const prodExport = JSON.parse((await cli(['config', 'export', '--env', 'prod'])).stdout);
  if (Object.keys(prodExport.entries).join() !== 'FLAG' || prodExport.entries.FLAG.value !== false) fail('export --env prod: should hold only prod rows');

  // round trip: applying what was exported changes nothing
  const same = join(dir, 'same.json');
  await cli(['config', 'export', '-o', same]);
  const noop = await code(['config', 'diff', '-f', same]);
  if (noop.code !== 0 || !/no changes/.test(noop.stdout)) fail(`diff of an export should be clean, got ${noop.code}: ${noop.stdout}`);

  const desired = join(dir, 'config.json');
  writeFileSync(desired, JSON.stringify({ apiVersion: 'fonderie/v1', kind: 'ConfigSet', entries: {
    FLAG: { value: false, description: 'show jobs' },
    LIMIT: { value: 'ten' },
    NEW: { value: [{ id: 'm1' }] },
  } }));
  const d = await code(['config', 'diff', '-f', desired]);
  if (d.code !== 1) fail(`diff with changes should exit 1, got ${d.code}`);
  for (const want of [/~ FLAG: true → false/, /\+ NEW = \[\{"id":"m1"\}\]/, /! LIMIT: type number → text/, /kept .*OLD/]) {
    if (!want.test(d.stdout)) fail(`diff output missing ${want}:\n${d.stdout}`);
  }
  const blocked = await code(['config', 'apply', '-f', desired]);
  if (blocked.code !== 2 || writes().length) fail(`a blocked type change must apply nothing and exit 2 (got ${blocked.code}, ${writes().length} writes)`);
  const dry = await code(['config', 'apply', '-f', desired, '--allow-type-change', '--prune', '--dry-run']);
  if (dry.code !== 0 || writes().length || !/dry run/.test(dry.stdout) || !/- OLD/.test(dry.stdout)) fail('--dry-run must print the plan and write nothing');

  await cli(['config', 'apply', '-f', desired, '--allow-type-change', '--prune']);
  const put = (k) => writes().find((r) => r.method === 'PUT' && r.url === `/_admin/config/${k}`);
  if (put('FLAG')?.body?.ifVersion !== 1 || put('FLAG').body.value !== false) fail('apply: FLAG update must carry ifVersion (no lost updates)');
  if (put('LIMIT')?.body?.allowTypeChange !== true) fail('apply: the type change must be explicit on the wire');
  if (put('FLAG').body.allowTypeChange) fail('apply: allowTypeChange must go only on writes that change the type');
  if (put('NEW')?.body?.ifVersion !== undefined || put('NEW').body.value[0].id !== 'm1') fail('apply: NEW should be created without ifVersion');
  if (!writes().some((r) => r.method === 'DELETE' && r.url === '/_admin/config/OLD')) fail('apply --prune: OLD should be deleted');
  if (writes().some((r) => r.url.includes('prod'))) fail('apply without --env must not touch prod rows');
  const again = await code(['config', 'apply', '-f', desired]);
  if (again.code !== 0 || !/no changes/.test(again.stdout)) fail('apply is idempotent: a second run changes nothing');

  // ifVersion is the version read by THIS run, so a concurrent edit gets a 409, not an overwrite
  rows.config.find((r) => r.key === 'FLAG' && r.environment === 'all').version = 99;
  writeFileSync(desired, JSON.stringify({ kind: 'ConfigSet', entries: { FLAG: { value: true } } }));
  // (the plan re-reads, so it sees v99 — prove ifVersion is the read version, not a stale constant)
  await cli(['config', 'apply', '-f', desired]);
  if (writes().at(-1).body.ifVersion !== 99) fail('apply: ifVersion must be the version read for this run');

  // manifests are validated whole before anything is sent
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ kind: 'SecretSet', entries: { '9bad': { value: 1 }, OK: {} } }));
  const b = await code(['config', 'apply', '-f', bad]);
  if (b.code !== 1 || !/kind must be "ConfigSet"/.test(b.stderr) || !/9bad: invalid key/.test(b.stderr) || !/OK: needs "value"/.test(b.stderr)) fail(`bad manifest should list every problem:\n${b.stderr}`);

  // the scope travels in the file: a prod export applies to prod, and a flag
  // that disagrees with it is an error, not a silent precedence rule
  const prodFile = join(dir, 'prod.json');
  await cli(['config', 'export', '--env', 'prod', '-o', prodFile]);
  const prodDiff = await code(['config', 'diff', '-f', prodFile]);
  if (prodDiff.code !== 0) fail(`a prod export must diff clean against prod without --env, got ${prodDiff.code}:\n${prodDiff.stdout}`);
  const clash = await code(['config', 'apply', '-f', prodFile, '--env', 'staging']);
  if (clash.code !== 1 || !/disagrees with the manifest's metadata.environment/.test(clash.stderr)) fail(`--env vs metadata clash must refuse:\n${clash.stderr}`);
  const typo = join(dir, 'typo.json');
  writeFileSync(typo, JSON.stringify({ kind: 'ConfigSet', entries: { A: { value: 1, descripton: 'x' } } }));
  const ty = await code(['config', 'diff', '-f', typo]);
  if (ty.code !== 1 || !/unknown field\(s\) descripton/.test(ty.stderr)) fail('a misspelled field must be reported, not ignored');

  // ── secrets: the same flow, and no value ever reaches stdout ──
  const secretOut = (await cli(['secret', 'export'])).stdout;
  const sx = JSON.parse(secretOut);
  if (sx.kind !== 'SecretSet' || sx.entries.API_KEY.valueFrom?.env !== 'API_KEY' || 'value' in sx.entries.API_KEY) fail('secret export: should emit a valueFrom placeholder');
  if (secretOut.includes('aaaa-old')) fail('secret export without --reveal must not contain a value');
  if (requests.some((r) => r.url.includes('/reveal'))) fail('secret export without --reveal must not reveal');
  const revealed = join(dir, 'secrets.json');
  const rv = await cli(['secret', 'export', '--reveal', '-o', revealed]);
  if (JSON.parse(readFileSync(revealed, 'utf8')).entries.API_KEY.value !== 'aaaa-old-secret-value') fail('secret export --reveal: value missing');
  if ((statSync(revealed).mode & 0o777) !== 0o600) fail('secret export --reveal: file must be 0600');
  if (!/plaintext/.test(rv.stderr)) fail('secret export --reveal: should warn about plaintext');

  const secretFile = join(dir, 'secretset.json');
  writeFileSync(secretFile, readFileSync(join(dir, 'secrets.json'), 'utf8').replace(/"value": "[^"]*"/, '"valueFrom": { "env": "API_KEY" }'));
  const sd = await code(['secret', 'diff', '-f', secretFile], { API_KEY: 'aaaa-new-secret-value' });
  if (sd.code !== 1 || !/~ API_KEY: value changed/.test(sd.stdout)) fail(`secret diff should see the change:\n${sd.stdout}`);
  if ((sd.stdout + sd.stderr).includes('aaaa-')) fail('secret diff must never print a value');
  const missingEnv = await code(['secret', 'diff', '-f', secretFile], { API_KEY: undefined });
  if (missingEnv.code !== 1 || !/API_KEY is not set/.test(missingEnv.stderr)) fail('valueFrom with the variable unset must fail before sending anything');
  const sa = await code(['secret', 'apply', '-f', secretFile], { API_KEY: 'aaaa-new-secret-value' });
  if (sa.code !== 0 || (sa.stdout + sa.stderr).includes('aaaa-')) fail('secret apply must succeed without printing values');
  if (writes().at(-1).body.value !== 'aaaa-new-secret-value' || writes().at(-1).body.ifVersion !== 2) fail('secret apply: wrong PUT');

  const dotenv = join(dir, '.env');
  writeFileSync(dotenv, '# comment\nAPI_KEY="aaaa-new-secret-value"\nexport WEBHOOK_SECRET=aaaa-bbbb-cccc-dddd\n\n');
  const fe = await code(['secret', 'apply', '--from-env-file', dotenv, '--env', 'prod']);
  if (fe.code !== 0 || !/\+ API_KEY/.test(fe.stdout) || !/\+ WEBHOOK_SECRET/.test(fe.stdout)) fail(`--from-env-file --env prod should add both to prod:\n${fe.stdout}`);
  if (writes().at(-1).body.environment !== 'prod' || !writes().at(-1).url.endsWith('?environment=prod')) fail('--env prod must scope the writes');
  const feAgain = await code(['secret', 'diff', '--from-env-file', dotenv, '--env', 'prod']);
  if (feAgain.code !== 0) fail('--from-env-file is idempotent');
  const feCfg = await code(['config', 'apply', '--from-env-file', dotenv]);
  if (feCfg.code !== 1 || !/for `fonderie secret`/.test(feCfg.stderr)) fail('--from-env-file is refused for config');

  // config public: unauthenticated, exactly what frontends get
  const pub = await cli(['config', 'public']);
  if (JSON.parse(pub.stdout).FLAG !== true) fail('config public: wrong output');
  if (requests.find((r) => r.url === '/config/public').auth) fail('config public must not send the admin token');

  // FONDERIE_ADMIN_PREFIX pins the base — no probe
  const before = requests.length;
  await cli(['config', 'export'], { FONDERIE_ADMIN_PREFIX: '/ops/' });
  const hits = requests.slice(before).map((r) => r.url);
  if (hits.join() !== '/ops/config') fail(`FONDERIE_ADMIN_PREFIX should skip the probe, saw ${hits}`);

  server.close();
  console.log('  ✓ config/secret export · diff · apply (fallback, round-trip, type guard, dry-run, prune, ifVersion, idempotent, secrets never printed, .env, public)');
})();

// ── template export · diff · apply (bodies in files next to the manifest) ────
await (async () => {
  const requests = [];
  const rows = [
    { type: 'auth.welcome', locale: null, subject: 'Welcome', text: 'Hi {{name}}', html: '<p>Hi {{name}}</p>\n<p>Thanks</p>', active: true, version: 3 },
    { type: 'auth.welcome', locale: 'fr', subject: 'Bienvenue', text: 'Salut {{name}}\nMerci', html: null, active: true, version: 1 },
    { type: 'billing.receipt', locale: null, subject: null, text: 'Receipt', html: null, active: false, version: 2 },
  ];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : undefined;
      requests.push({ method: req.method, url: req.url, body });
      const u = new URL(req.url, 'http://x');
      const send = (status, result) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ reason: 'X', explanation: status === 409 ? 'stale' : 'ok', result })); };
      const m = /^\/_admin\/templates(?:\/([^/]+))?$/.exec(u.pathname);
      if (!m) return send(404, null);
      if (!m[1]) return send(200, rows);
      const type = decodeURIComponent(m[1]);
      const locale = u.searchParams.get('locale');
      const row = rows.find((r) => r.type === type && r.locale === locale);
      if (req.method === 'DELETE') { rows.splice(rows.indexOf(row), 1); return send(200, null); }
      if (req.method === 'PUT') {
        if (row && body.ifVersion !== undefined && body.ifVersion !== row.version) return send(409, null);
        // full replace, like the server: omitted subject/html become null
        const next = { type, locale, subject: body.subject ?? null, text: body.text, html: body.html ?? null, active: body.active ?? true, version: (row?.version ?? 0) + 1 };
        if (row) rows.splice(rows.indexOf(row), 1, next); else rows.push(next);
        return send(200, next);
      }
      return send(404, null);
    });
  });
  await new Promise((r) => server.listen(0, r));
  const env = { ...process.env, FONDERIE_ADMIN_URL: `http://127.0.0.1:${server.address().port}`, FONDERIE_ADMIN_TOKEN: 'sekret', FONDERIE_ADMIN_PREFIX: '/_admin' };
  const code = async (args) => { try { return { code: 0, ...(await execFileP('node', [bin, ...args], { env })) }; } catch (e) { return { code: e.code, stdout: e.stdout, stderr: e.stderr }; } };
  const writes = () => requests.filter((r) => r.method === 'PUT' || r.method === 'DELETE');
  const dir = mkdtempSync(join(tmpdir(), 'fonderie-templates-'));

  // stdout export: default locale only, everything inline
  const inline = JSON.parse((await code(['template', 'export'])).stdout);
  if (inline.kind !== 'TemplateSet' || inline.metadata.locale !== null) fail('template export: wrong envelope');
  if (Object.keys(inline.entries).join() !== 'auth.welcome,billing.receipt') fail(`template export: default locale only, got ${Object.keys(inline.entries)}`);
  if (inline.entries['auth.welcome'].html !== '<p>Hi {{name}}</p>\n<p>Thanks</p>') fail('template export to stdout keeps html inline');
  if ('subject' in inline.entries['billing.receipt'] || inline.entries['billing.receipt'].active !== false) fail('template export: omit null subject, keep active:false');

  // -o export: html and multi-line text to files, named with the locale
  const fr = join(dir, 'fr.json');
  const ex = await code(['template', 'export', '--locale', 'fr', '-o', fr]);
  const frm = JSON.parse(readFileSync(fr, 'utf8'));
  if (frm.metadata.locale !== 'fr' || frm.entries['auth.welcome'].textFrom?.file !== 'auth.welcome.fr.txt') fail('template export -o: multi-line text should go to auth.welcome.fr.txt');
  if (readFileSync(join(dir, 'auth.welcome.fr.txt'), 'utf8') !== 'Salut {{name}}\nMerci') fail('template export -o: body file content wrong');
  if (!/\+1 body file/.test(ex.stderr)) fail('template export -o: should report the body files');
  const def = join(dir, 'default.json');
  await code(['template', 'export', '-o', def]);
  const defm = JSON.parse(readFileSync(def, 'utf8'));
  if (defm.entries['auth.welcome'].htmlFrom?.file !== 'auth.welcome.html' || defm.entries['auth.welcome'].text !== 'Hi {{name}}') fail('template export -o: html to a file, one-line text inline');

  // round trip is clean for both locales (fr resolved from metadata, no flag)
  for (const f of [fr, def]) {
    const r = await code(['template', 'diff', '-f', f]);
    if (r.code !== 0) fail(`template diff of its own export must be clean (${f}):\n${r.stdout}${r.stderr}`);
  }

  // edit a body file → diff names the field and the size, apply sends the whole template
  writeFileSync(join(dir, 'auth.welcome.html'), '<p>Hello {{name}}</p>\n<p>Thanks</p>\n<p>The team</p>');
  defm.entries['auth.welcome'].subject = 'Welcome aboard';
  defm.entries['billing.receipt'].active = true;
  defm.entries['auth.goodbye'] = { text: 'Bye' };
  writeFileSync(def, JSON.stringify(defm));
  const d = await code(['template', 'diff', '-f', def]);
  if (d.code !== 1) fail('template diff with changes should exit 1');
  for (const want of [/~ auth\.welcome: subject "Welcome" → "Welcome aboard", html changed \(2 → 3 lines\)/, /~ billing\.receipt: activated/, /\+ auth\.goodbye  \(new\)/]) {
    if (!want.test(d.stdout)) fail(`template diff missing ${want}:\n${d.stdout}`);
  }
  if (writes().length) fail('template diff must not write');
  await code(['template', 'apply', '-f', def]);
  const w = writes().find((r) => r.url === '/_admin/templates/auth.welcome');
  if (!w || w.body.ifVersion !== 3 || w.body.subject !== 'Welcome aboard' || !w.body.html.includes('The team') || w.body.text !== 'Hi {{name}}' || w.body.active !== true) fail(`template apply: must send the whole template with ifVersion, got ${JSON.stringify(w?.body)}`);
  if (writes().some((r) => r.url.includes('locale='))) fail('template apply on the default locale must not send ?locale=');
  if ((await code(['template', 'diff', '-f', def])).code !== 0) fail('template apply is idempotent');

  // --prune on fr deletes only fr rows; the default locale is untouched
  delete frm.entries['auth.welcome'];
  frm.entries['auth.reset'] = { subject: 'Réinitialiser', text: 'Lien : {{url}}' };
  writeFileSync(fr, JSON.stringify(frm));
  await code(['template', 'apply', '-f', fr, '--prune']);
  if (!writes().some((r) => r.method === 'DELETE' && r.url === '/_admin/templates/auth.welcome?locale=fr')) fail('template --prune: fr auth.welcome should be deleted');
  if (!writes().some((r) => r.method === 'PUT' && r.url === '/_admin/templates/auth.reset?locale=fr')) fail('template apply: new fr template should PUT with ?locale=fr');
  if (!rows.some((r) => r.type === 'auth.welcome' && r.locale === null)) fail('template --prune on fr must not touch the default locale');

  // validation: missing body file, both text and textFrom, bad active
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ kind: 'TemplateSet', entries: { a: { textFrom: { file: 'missing.txt' } }, b: { text: 'x', textFrom: { file: 'x' } }, c: { text: 'x', active: 'yes' }, d: { subject: 's' } } }));
  const b = await code(['template', 'apply', '-f', bad]);
  for (const want of [/a: textFrom file missing\.txt cannot be read/, /b: give text or textFrom, not both/, /c: active must be true or false/, /d: needs "text" or "textFrom"/]) {
    if (!want.test(b.stderr)) fail(`template manifest validation missing ${want}:\n${b.stderr}`);
  }
  if (b.code !== 1) fail('template bad manifest should exit 1');

  server.close();
  console.log('  ✓ template export · diff · apply (inline vs body files, per-locale, round-trip, whole-template PUT + ifVersion, idempotent, locale-scoped prune, validation)');
})();

console.log('fonderie CLI test: all assertions passed (skill, query installed/uninstalled, init wires idempotent fresh-keeping postinstall, add guards, config/secret management, config/secret/template manifests)');
