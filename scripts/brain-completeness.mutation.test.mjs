#!/usr/bin/env node
// Mutation tests for leg 3 of scripts/brain-completeness.test.mjs (the
// "registers routes but brain reports zero" guard). Drives the pure detector
// against fixture packages to prove each failure mode fires — including the
// template-literal route form (`${base}/stream`) that left sse invisible to
// both the generator and this guard until the 2026-10 audit — then against
// the real repo to prove sse is seen and no live package has a gap.
// Zero deps, exits non-zero on failure — safe for CI.
//
//   node scripts/brain-completeness.mutation.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { registersRoutes, routeRegistrationGaps } from './brain-completeness.test.mjs';

const root = join(import.meta.dirname, '..');

let failed = false;
const assert = (cond, msg) => {
	if (!cond) {
		failed = true;
		console.error('FAIL:', msg);
	} else {
		console.log('ok:', msg);
	}
};

// ── Fixtures ─────────────────────────────────────────────────────────────────
const fixture = mkdtempSync(join(tmpdir(), 'brain-completeness-'));
const fx = (pkg, src) => {
	const dir = join(fixture, pkg, 'src');
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'module.ts'), src);
};

try {
	// Baseline: no route registrations → no gap, detector silent.
	fx('pkg-quiet', 'export const x = 1;\n');
	assert(registersRoutes(join(fixture, 'pkg-quiet', 'src')) === false, 'fixture baseline: no registrations detected');
	assert(
		routeRegistrationGaps({ packages: { 'pkg-quiet': { routeCount: 0 } } }, fixture).length === 0,
		'fixture baseline: a package with no routes passes',
	);

	// Mutation 1: a literal route with routeCount 0 → flagged.
	fx('pkg-literal', `app.addRoute('GET', '/things', handler);\n`);
	assert(
		routeRegistrationGaps({ packages: { 'pkg-literal': { routeCount: 0 } } }, fixture).includes('pkg-literal'),
		'mutation 1: literal route with routeCount 0 is flagged',
	);

	// Mutation 2: a TEMPLATE-LITERAL route with routeCount 0 → flagged. This is
	// the sse blind spot: the old regex required ['/"] before the path, so this
	// fixture passed silently while checking nothing.
	fx('pkg-template', 'app.addRoute(\n\t\'GET\',\n\t`${base}/stream`,\n\thandler,\n);\n');
	assert(registersRoutes(join(fixture, 'pkg-template', 'src')) === true, 'mutation 2a: template-literal route is detected');
	assert(
		routeRegistrationGaps({ packages: { 'pkg-template': { routeCount: 0 } } }, fixture).includes('pkg-template'),
		'mutation 2b: template-literal route with routeCount 0 is flagged',
	);

	// Mutation 3: registered routes with an honest routeCount → no gap.
	assert(
		routeRegistrationGaps(
			{ packages: { 'pkg-literal': { routeCount: 1 }, 'pkg-template': { routeCount: 2 } } },
			fixture,
		).length === 0,
		'mutation 3: registrations with matching routeCount pass',
	);
} finally {
	rmSync(fixture, { recursive: true, force: true });
}

// ── Real repo ────────────────────────────────────────────────────────────────
// Pins the audit finding itself: the detector must SEE sse's routes (it did
// not, before), and no package may have a live registration gap.
const brain = JSON.parse(readFileSync(join(root, '.claude/skills/fonderie/brain.json'), 'utf8'));
assert(
	registersRoutes(join(root, 'packages/sse/src')) === true,
	'real repo: detector sees sse\'s template-literal routes',
);
const gaps = routeRegistrationGaps(brain, join(root, 'packages'));
assert(gaps.length === 0, `real repo: no route-registration gaps (got: ${gaps.join(', ') || 'none'})`);

if (failed) {
	console.error('\nbrain-completeness mutation tests FAILED');
	process.exit(1);
}
console.log('\nbrain-completeness mutation tests passed.');
