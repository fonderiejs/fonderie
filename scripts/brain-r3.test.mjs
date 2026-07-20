#!/usr/bin/env node
// R3 skew-immunity test (BRAIN_PLAN.md "R3 update"). Proves the project brain
// reads each installed package's CO-LOCATED fragment, never the repo's central
// "latest" — so knowledge is version-matched by construction. Fabricates its
// own fixtures; zero deps; exits non-zero on failure.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gen = join(here, 'generate-project-brain.mjs');
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };

const installPkg = (proj, name, version, brain) => {
  const d = join(proj, 'node_modules', '@fonderie', name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: `@fonderie/${name}`, version }));
  if (brain) {
    mkdirSync(join(d, 'brain'), { recursive: true });
    for (const [kind, body] of Object.entries(brain)) writeFileSync(join(d, 'brain', `${kind}.md`), body);
  }
  return d;
};
const run = (proj) => execFileSync('node', [gen, '--project', proj], { encoding: 'utf8' });

// ── 1. Co-located fragment wins, even at a version central has never seen ────
// auth@9.9.9 does not exist in the repo; if the brain showed central "latest",
// it would leak the repo's real auth signatures. A unique sentinel proves the
// installed fragment is what surfaced.
const skew = mkdtempSync(join(tmpdir(), 'fonderie-r3-skew-'));
const SENTINEL = 'SENTINEL_AUTH_9_9_9_COLOCATED';
installPkg(skew, 'auth', '9.9.9', {
  signatures: `# @fonderie/auth — signatures\n\n${SENTINEL}\n`,
  outcomes: `# @fonderie/auth — outcomes\n\nfunction fromInstalledTarball(): void\n`,
});
const s = run(skew);
if (!s.includes('@fonderie/auth@9.9.9')) fail('installed version 9.9.9 missing from header');
if (!s.includes(SENTINEL)) fail('co-located fragment not used — central "latest" leaked onto the installed path (skew!)');
if (/interface IUser/.test(s)) fail('central auth signatures present — the repo copy leaked instead of the installed one');
if (/central fallback/i.test(s)) fail('a co-located package was wrongly flagged as fallback');

// ── 2. No co-located fragment → central fallback, flagged loudly (not silent) ─
const legacy = mkdtempSync(join(tmpdir(), 'fonderie-r3-legacy-'));
installPkg(legacy, 'auth', '1.3.0'); // no brain/ dir — a pre-co-location publish
const l = run(legacy);
if (!/interface IUser/.test(l)) fail('central fallback did not supply signatures for a legacy package');
if (!/may not match this installed version/i.test(l)) fail('fallback not flagged — skew would be silent');

// ── 3. Determinism unchanged ─────────────────────────────────────────────────
if (run(skew) !== s) fail('not byte-deterministic across runs');

rmSync(skew, { recursive: true, force: true });
rmSync(legacy, { recursive: true, force: true });
console.log('brain-r3 test: co-located wins, fallback flagged, deterministic — all passed');
