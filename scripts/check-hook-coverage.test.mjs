#!/usr/bin/env node
// Mutation tests for leg 3 of scripts/check-hook-coverage.mjs (the stale
// doc-identifier guard). Drives the pure check against a synthetic fixture
// root to prove each failure mode fires, then against the real repo to prove
// every TEMP_STALE_ALLOW entry matches a live stale reference — deleting an
// entry, fixing a doc, or renaming a hook must each turn the gate red.
// Zero deps, exits non-zero on failure — safe for CI.
//
//   node scripts/check-hook-coverage.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkStaleIdentifiers, TEMP_STALE_ALLOW } from './check-hook-coverage.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = false;
const assert = (cond, msg) => {
	if (!cond) {
		failed = true;
		console.error('FAIL:', msg);
	} else {
		console.log('ok:', msg);
	}
};

// ── Fixture: one react package, one hook, docs that cite it ──────────────────
const fixture = mkdtempSync(join(tmpdir(), 'hook-coverage-'));
const fx = (rel, content) => {
	const p = join(fixture, rel);
	mkdirSync(dirname(p), { recursive: true });
	writeFileSync(p, content);
};
fx('packages/react-demo/src/hooks/useReal.ts', 'export function useReal() {}\n');
fx('packages/react-demo/README.md', '# demo\n\nUse `useReal` for the real thing.\n');
fx('.claude/skills/fonderie/brain-knowledge.json', '{ "aliases": { "demo": "wraps useReal" } }\n');

try {
	// Baseline: everything resolves, no allow-list needed.
	let r = checkStaleIdentifiers(fixture, new Map());
	assert(r.failures.length === 0 && r.staleEntries.length === 0, 'fixture baseline passes');
	assert(r.scanned > 0, `fixture scanned count is nonzero (${r.scanned})`);

	// Mutation 1: a doc cites a hook that does not exist → flagged.
	fx('packages/react-demo/README.md', '# demo\n\nUse `useReal` and `useGhost`.\n');
	r = checkStaleIdentifiers(fixture, new Map());
	assert(r.failures.length === 1 && r.failures[0] === 'useGhost', 'mutation 1: injected stale name is flagged');

	// Mutation 2: allow-listing the stale name silences it…
	r = checkStaleIdentifiers(fixture, new Map([['useGhost', 'pending PR 3']]));
	assert(r.failures.length === 0 && r.staleEntries.length === 0, 'mutation 2: allow-listed stale name passes');

	// Mutation 3: …but once the doc is fixed, the lingering entry fails.
	fx('packages/react-demo/README.md', '# demo\n\nUse `useReal` for the real thing.\n');
	r = checkStaleIdentifiers(fixture, new Map([['useGhost', 'pending PR 3']]));
	assert(r.staleEntries.length === 1 && r.staleEntries[0] === 'useGhost', 'mutation 3: stale allow-list entry is flagged');

	// Mutation 4: a cite that only lives in brain-knowledge.json is scanned too.
	fx('.claude/skills/fonderie/brain-knowledge.json', '{ "aliases": { "demo": "wraps useGhostJson" } }\n');
	r = checkStaleIdentifiers(fixture, new Map());
	assert(r.failures.includes('useGhostJson'), 'mutation 4: stale name in brain-knowledge.json is flagged');

	// Mutation 5: third-party hooks in fenced code blocks are NOT scanned —
	// only backticked inline-code citations count (documented scope rule).
	fx('.claude/skills/fonderie/brain-knowledge.json', '{ "aliases": {} }\n');
	fx(
		'packages/react-demo/README.md',
		'# demo\n\nUse `useReal`.\n\n```tsx\nimport { useStripe, useElements } from \'@stripe/react-stripe-js\';\n```\n',
	);
	r = checkStaleIdentifiers(fixture, new Map());
	assert(r.failures.length === 0, 'mutation 5: useStripe/useElements in a fenced import sample are ignored');
} finally {
	rmSync(fixture, { recursive: true, force: true });
}

// ── Real repo: the temporary allow-list is exact ─────────────────────────────
// With an EMPTY allow-list the gate must see exactly the allow-listed names —
// no more (an unlisted stale name would pass silently otherwise), no fewer
// (a dead entry would survive PR 3's cleanup). With the real allow-list it
// must pass clean.
const bare = checkStaleIdentifiers(root, new Map());
assert(
	bare.failures.length === TEMP_STALE_ALLOW.size && bare.failures.every((n) => TEMP_STALE_ALLOW.has(n)),
	`real repo: empty allow-list surfaces exactly the ${TEMP_STALE_ALLOW.size} known stale names (got ${bare.failures.length}: ${bare.failures.join(', ')})`,
);
assert(bare.scanned > 0, `real repo: scanned-identifier count is nonzero (${bare.scanned})`);
const allowed = checkStaleIdentifiers(root);
assert(allowed.failures.length === 0 && allowed.staleEntries.length === 0, 'real repo: temporary allow-list passes clean');

if (failed) {
	console.error('\ncheck-hook-coverage mutation tests FAILED');
	process.exit(1);
}
console.log('\ncheck-hook-coverage mutation tests passed.');
