#!/usr/bin/env node
// Smoke test for the fonderie CLI — fabricates a fixture project with a couple of
// installed @fonderie packages (each with a co-located brain/ fragment) and
// asserts `skill` writes a router + bodies, and `query` answers correctly.
// Zero deps; exits non-zero on failure.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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

// router should be small (lazy) — a few hundred to ~2k tokens, not the 6-28k eager brain
if (Math.ceil(router.length / 4) > 3000) fail(`router too big (~${Math.ceil(router.length / 4)} tok) — lazy defeated`);

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

console.log('fonderie CLI test: all assertions passed (skill, query installed/uninstalled, init wires idempotent fresh-keeping postinstall, add guards)');
