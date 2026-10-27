#!/usr/bin/env node
// brain.json is the map the assistant reads instead of excavating source. A
// gap in it is not a wrong answer — it is an INVISIBLE one: the reader never
// learns the route, package or dependency exists, and has no way to notice.
//
// Every assertion here exists because the thing it checks was ONCE SILENTLY
// WRONG, found by audit rather than by any gate:
//
//   7 routes missing across 5 packages   media advertised 1 route, had 3     (2026-09-23)
//   core reported 0 routes               /healthz /readyz /metrics invisible (2026-09-23)
//   @fonderie/storage/s3 missing         a digit in the subpath              (2026-09-23)
//   105 dependency edges missing         the graph was peers-only            (2026-09-23)
//   sse reported 0 routes                template-literal paths (`${base}/…`) (2026-10-26)
//                                        matched nothing, in the GENERATOR
//                                        and in this guard's own regex alike
//
// None of those failed anything. Each generator matched what it could, skipped
// what it could not, printed a cheerful count and exited 0. That is the failure
// mode this file exists to make impossible: it compares the brain against the
// SOURCE OF TRUTH on disk and fails on any shortfall.
//
// Run by `npm run brain:completeness` (and via `npm run brain:test`) in CI.
// Mutation tests: node scripts/brain-completeness.mutation.test.mjs
// (npm run brain:completeness:test).


import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(import.meta.dirname, '..');
const brain = JSON.parse(readFileSync(join(root, '.claude/skills/fonderie/brain.json'), 'utf8'));
const sigDir = join(root, '.claude/skills/fonderie/signatures');
const pkgsDir = join(root, 'packages');

let failures = 0;
const fail = (msg) => {
	console.error(`FAIL: ${msg}`);
	failures++;
};
const pkgJson = (p) => JSON.parse(readFileSync(join(pkgsDir, p, 'package.json'), 'utf8'));

// ── leg-3 helpers, exported for the mutation tests ─────────────────────────
// The detector and the gap-finder are pure so
// scripts/brain-completeness.mutation.test.mjs can drive them against fixture
// packages — a guard that can't be proven to fail on an injected violation
// isn't a guard.

// A route-registration call in source. The second argument may open with a
// quote-and-slash ('/path') OR a backtick — sse writes `${base}/stream`, and
// the first version of this regex required ['/"], so it could never see those
// routes. It passed while checking nothing for exactly the package shape it
// was written to catch — same bug as leg 2's, one level up.
export const ROUTE_REGISTERS =
	/\.(?:addRoute|add)\(\s*['"](?:GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*(?:['"]\/|`)/;

export const tsSourceFiles = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		if (e.name === '__tests__' || e.name.endsWith('.test.ts')) return [];
		const p = join(dir, e.name);
		return e.isDirectory() ? tsSourceFiles(p) : e.name.endsWith('.ts') ? [p] : [];
	});

export function registersRoutes(srcDir) {
	return (
		existsSync(srcDir) && tsSourceFiles(srcDir).some((f) => ROUTE_REGISTERS.test(readFileSync(f, 'utf8')))
	);
}

// Names of brain packages whose src/ registers routes while the brain reports
// zero. "Zero" and "not looked" must not be the same answer.
export function routeRegistrationGaps(brainJson, packagesDir) {
	const gaps = [];
	for (const [name, entry] of Object.entries(brainJson.packages)) {
		if (registersRoutes(join(packagesDir, name, 'src')) && (entry.routeCount ?? 0) === 0)
			gaps.push(name);
	}
	return gaps;
}

// ── 1. every library package is present ─────────────────────────────────────
// A package absent from the brain is a package the reader will not know exists.
function leg1() {
	const onDisk = readdirSync(pkgsDir).filter((p) => {
		if (!existsSync(join(pkgsDir, p, 'package.json'))) return false;
		const j = pkgJson(p);
		// `bin` packages are commands, not bricks — excluded by the generator on
		// purpose. Mirrored here so this test encodes the same contract.
		return j.name?.startsWith('@fonderie/') && !j.bin && existsSync(join(pkgsDir, p, 'src/index.ts'));
	});
	const missing = onDisk.filter((p) => !brain.packages[p]);
	if (missing.length) fail(`packages missing from brain.json: ${missing.join(', ')}`);
}

// ── 2. no route row is silently dropped ─────────────────────────────────────
// The original bug: a handler containing a template literal put backticks in
// the middleware cell, the row failed to match, and it vanished without a word.
function leg2() {
	let present = 0;
	let parsed = 0;
	for (const f of readdirSync(sigDir).filter((f) => f.endsWith('-outcomes.md'))) {
		const s = readFileSync(join(sigDir, f), 'utf8');
		present += [...s.matchAll(/^\| (?:GET|POST|PUT|DELETE|PATCH) \| /gm)].length;
		parsed += [...s.matchAll(/^\| (?:GET|POST|PUT|DELETE|PATCH) \| `[^`]+` \| `.+` \|$/gm)].length;
	}
	if (present !== parsed) fail(`${present - parsed} route row(s) do not parse — brain.json under-reports`);

	const counted = Object.values(brain.packages).reduce((n, p) => n + (p.routeCount ?? 0), 0);
	if (counted !== parsed) fail(`brain records ${counted} routes but ${parsed} rows parse`);
}

// ── 3. a package that registers routes must report some ─────────────────────
// core reported zero for years because its probes use a call form the AST walk
// did not recognise; sse reported zero because its template-literal paths
// matched neither the generator nor this leg's old regex.
function leg3() {
	for (const name of routeRegistrationGaps(brain, pkgsDir))
		fail(`${name} registers routes in src/ but brain.json reports routeCount 0`);
}

// ── 4. subpath exports match the exports map ────────────────────────────────
// '@fonderie/storage/s3' was dropped because the pattern excluded digits.
function leg4() {
	for (const [name, entry] of Object.entries(brain.packages)) {
		const j = pkgJson(name);
		const real = Object.keys(j.exports ?? {})
			.filter((k) => k !== '.' && k !== './package.json')
			.map((k) => j.name + k.slice(1));
		const rec = new Set(entry.subpaths ?? []);
		const missing = real.filter((s) => !rec.has(s));
		if (missing.length) fail(`${name}: subpaths missing from brain.json: ${missing.join(', ')}`);
	}
}

// ── 5. the dependency graph is complete ─────────────────────────────────────
// `requires` is peers (what a consumer must install); `dependsOn` is real
// dependencies. The graph was built from peers alone, so 56 packages showed no
// edges at all — react-admin-screens appeared to depend on nothing.
function leg5() {
	for (const [name, entry] of Object.entries(brain.packages)) {
		const j = pkgJson(name);
		const deps = Object.keys(j.dependencies ?? {})
			.filter((k) => k.startsWith('@fonderie/'))
			.map((k) => k.replace('@fonderie/', ''));
		const rec = new Set(entry.dependsOn ?? []);
		const missing = deps.filter((d) => !rec.has(d));
		if (missing.length) fail(`${name}: dependsOn missing ${missing.join(', ')}`);

		const peers = Object.keys(j.peerDependencies ?? {})
			.filter((k) => k.startsWith('@fonderie/'))
			.map((k) => k.replace('@fonderie/', ''));
		const recP = new Set(entry.requires ?? []);
		const missingP = peers.filter((d) => !recP.has(d));
		if (missingP.length) fail(`${name}: requires missing ${missingP.join(', ')}`);
	}
	const edgeKeys = new Set(brain.edges.map((e) => `${e.from}->${e.to}->${e.type}`));
	for (const [name, entry] of Object.entries(brain.packages)) {
		for (const d of entry.dependsOn ?? [])
			if (!edgeKeys.has(`${name}->${d}->depends-on`)) fail(`edge missing: ${name} depends-on ${d}`);
		for (const d of entry.requires ?? [])
			if (!edgeKeys.has(`${name}->${d}->requires`)) fail(`edge missing: ${name} requires ${d}`);
	}
}

// ── 6. recorded tables match the migrations on disk ─────────────────────────
function leg6() {
	for (const [name, entry] of Object.entries(brain.packages)) {
		const sqlDir = join(pkgsDir, name, 'src/migrations/sql');
		if (!existsSync(sqlDir)) continue;
		const sql = readdirSync(sqlDir)
			.filter((f) => f.endsWith('.sql'))
			.map((f) => readFileSync(join(sqlDir, f), 'utf8'))
			.join('\n');
		const created = new Set(
			[...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z0-9_]+)/gi)].map((m) =>
				m[1].toLowerCase(),
			),
		);
		for (const m of sql.matchAll(/DROP TABLE (?:IF EXISTS )?([a-z0-9_]+)/gi))
			created.delete(m[1].toLowerCase());
		const rec = new Set(entry.tables ?? []);
		const missing = [...created].filter((t) => !rec.has(t));
		if (missing.length) fail(`${name}: tables missing from brain.json: ${missing.join(', ')}`);
	}
}

// ── 7. versions are not stale ───────────────────────────────────────────────
function leg7() {
	for (const [name, entry] of Object.entries(brain.packages)) {
		const v = pkgJson(name).version;
		if (entry.version !== v) fail(`${name}: brain says ${entry.version}, package.json says ${v}`);
		if (brain.sdkVersions[name] && brain.sdkVersions[name] !== v)
			fail(`${name}: sdkVersions says ${brain.sdkVersions[name]}, package.json says ${v}`);
	}
}

const isMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	leg1();
	leg2();
	leg3();
	leg4();
	leg5();
	leg6();
	leg7();

	if (failures) {
		console.error(
			`\nbrain-completeness: ${failures} gap(s). brain.json is what the assistant reads ` +
				`INSTEAD of the source — anything missing here is invisible, not merely wrong. ` +
				`Run \`npm run docs:signatures && npm run docs:brain\`; if that does not fix it, ` +
				`a generator is dropping something silently.`,
		);
		process.exit(1);
	}
	console.log(
		`brain-completeness — ${Object.keys(brain.packages).length} packages, ` +
			`${Object.values(brain.packages).reduce((n, p) => n + (p.routeCount ?? 0), 0)} routes, ` +
			`${brain.edges.length} edges checked against source; no gaps.`,
	);
}
