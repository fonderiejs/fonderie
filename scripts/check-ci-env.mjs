#!/usr/bin/env node
// CI-env gate. turbo passes a task only the environment variables listed in
// turbo.json's test "env" (and keys its cache on them). A variable CI sets
// for gated tests but turbo.json omits never reaches the test: the suite
// reports SKIP and CI stays green. It happened to billing, then to admin (11
// tests) and courier (2) — this makes it a failure instead of a memory.
//
// Rule: every *_URL variable the CI test job sets must be in turbo.json's
// tasks.test.env.
//
// Run: npm run check:ci-env
import { readFileSync } from 'node:fs';

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const turboRaw = readFileSync(new URL('../turbo.json', import.meta.url), 'utf8');
// turbo.json allows comments; strip them before parsing.
const turbo = JSON.parse(turboRaw.replace(/^\s*\/\/.*$/gm, ''));

const set = [...new Set([...ci.matchAll(/^\s+([A-Z][A-Z0-9_]*_URL):\s/gm)].map((m) => m[1]))];
const passed = new Set(turbo.tasks?.test?.env ?? []);
const missing = set.filter((v) => !passed.has(v));

console.log(`check:ci-env — ${set.length} *_URL variable(s) set in ci.yml, ${passed.size} passed through by turbo.json`);
if (set.length === 0) {
	console.error('  ✗ found no *_URL variables in ci.yml — the parser is broken, refusing to pass');
	process.exit(2);
}
if (missing.length) {
	for (const v of missing) console.error(`  ✗ ${v} is set in ci.yml but not in turbo.json tasks.test.env — its gated tests SKIP in CI`);
	process.exit(1);
}
console.log('  ✓ every CI test variable reaches the tests');
