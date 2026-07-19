#!/usr/bin/env node
// Smoke + determinism test for generate-project-brain.mjs. Fabricates its own
// fixture project (no dependence on any skeleton's node_modules — CI-safe),
// asserts: selectivity (only installed packages), sufficiency (exact
// signatures present), discovery pointer, and byte-determinism across runs.
// Zero deps, exits non-zero on failure.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gen = join(here, 'generate-project-brain.mjs');

const fail = (msg) => { console.error('FAIL:', msg); process.exit(1); };

// fixture: a project with auth + core installed (billing NOT installed)
const proj = mkdtempSync(join(tmpdir(), 'fonderie-pb-test-'));
for (const [name, version] of [['auth', '1.3.0'], ['core', '0.1.4']]) {
  const d = join(proj, 'node_modules', '@fonderie', name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: `@fonderie/${name}`, version }));
}

const run = () => execFileSync('node', [gen, '--project', proj], { encoding: 'utf8' });
const a = run();
const b = run();

if (a !== b) fail('not byte-deterministic across runs');
if (!a.includes('@fonderie/auth@1.3.0')) fail('installed auth version missing from header');
if (!/## @fonderie\/auth@1\.3\.0/.test(a)) fail('auth section missing');
if (!/interface IUser/.test(a)) fail('exact auth signatures (IUser) missing — sufficiency broken');
if (!/HTTP routes registered/.test(a)) fail('auth outcomes (routes) missing');
if (/## @fonderie\/billing@/.test(a)) fail('billing section present but billing is NOT installed — selectivity broken');
if (!/brain_query/.test(a)) fail('discovery pointer (brain_query) missing');
if (!/jwt-secret-from-env/i.test(a)) fail('security invariants missing');

// empty project → still valid doc with discovery pointer
const empty = mkdtempSync(join(tmpdir(), 'fonderie-pb-empty-'));
const e = execFileSync('node', [gen, '--project', empty], { encoding: 'utf8' });
if (!/No @fonderie packages installed/.test(e)) fail('empty-project doc missing');
if (!/brain_query/.test(e)) fail('empty-project discovery pointer missing');

rmSync(proj, { recursive: true, force: true });
rmSync(empty, { recursive: true, force: true });
console.log(`project-brain test: all assertions passed (doc ~${Math.ceil(a.length / 4)} tokens for auth+core)`);
