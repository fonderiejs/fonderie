// Tests for env declarations: resolution over a fabricated node_modules tree,
// declaration validation, and the process.env source scanner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveEnv, resolveBricks, validateDeclaration, scanEnvReads, blankCommentsAndStrings } from './env.mjs';

const v = (name, extra = {}) => ({
	name,
	source: 'option',
	required: 'never',
	secret: false,
	kind: 'string',
	description: `${name} for tests`,
	...extra,
});

/** A project: app package.json + node_modules/@fonderie/<name> with package.json and env.json. */
function project({ app, bricks, appDecl }) {
	const root = mkdtempSync(join(tmpdir(), 'fonderie-env-'));
	writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: app }));
	for (const [name, { pkg = {}, decl }] of Object.entries(bricks)) {
		const d = join(root, 'node_modules', '@fonderie', name);
		mkdirSync(d, { recursive: true });
		writeFileSync(join(d, 'package.json'), JSON.stringify({ name: `@fonderie/${name}`, version: '1.0.0', ...pkg }));
		if (decl !== undefined) writeFileSync(join(d, 'env.json'), JSON.stringify(decl));
	}
	if (appDecl) writeFileSync(join(root, 'fonderie.env.json'), JSON.stringify(appDecl));
	return root;
}

const DB = v('DATABASE_URL', { required: 'always', secret: true, kind: 'postgres-url' });

const standard = (extra = {}) => ({
	core: { decl: { vars: [v('NODE_ENV', { source: 'direct', required: 'production', kind: 'enum:development|test|production', dev: 'development' })] } },
	store: { pkg: { dependencies: { '@fonderie/core': '*' } }, decl: { vars: [DB] } },
	billing: { pkg: { peerDependencies: { '@fonderie/core': '*' } }, decl: { vars: [v('STRIPE_SECRET_KEY', { required: 'always', secret: true })] } },
	adapter: {
		pkg: {
			peerDependencies: { '@fonderie/core': '*', '@fonderie/billing': '*' },
			peerDependenciesMeta: { '@fonderie/billing': { optional: true } },
		},
		decl: { vars: [] },
	},
	...extra,
});

// ── resolution ───────────────────────────────────────────────────────────────

test('follows dependencies and required peers; skips an optional peer the app did not install', () => {
	const root = project({ app: { '@fonderie/adapter': '*', '@fonderie/store': '*' }, bricks: standard() });
	const r = resolveEnv(root);
	assert.deepEqual(r.bricks.sort(), ['@fonderie/adapter', '@fonderie/core', '@fonderie/store']);
	assert.ok(!r.entries.some((e) => e.name === 'STRIPE_SECRET_KEY'));
});

test('follows an optional peer when the app installs it', () => {
	const root = project({ app: { '@fonderie/adapter': '*', '@fonderie/billing': '*' }, bricks: standard() });
	assert.ok(resolveEnv(root).entries.some((e) => e.name === 'STRIPE_SECRET_KEY'));
});

test('one entry per name; strongest required wins; every declarer recorded', () => {
	const bricks = standard({
		events: { pkg: { dependencies: { '@fonderie/store': '*' } }, decl: { vars: [{ ...DB, required: 'never' }] } },
	});
	const root = project({ app: { '@fonderie/events': '*' }, bricks });
	const db = resolveEnv(root).entries.filter((e) => e.name === 'DATABASE_URL');
	assert.equal(db.length, 1);
	assert.equal(db[0].required, 'always');
	assert.deepEqual(db[0].declaredBy.sort(), ['@fonderie/events', '@fonderie/store']);
});

test('conflicting kind or secret for one name throws naming both sides', () => {
	const bricks = standard({
		events: { pkg: { dependencies: { '@fonderie/store': '*' } }, decl: { vars: [{ ...DB, secret: false }] } },
	});
	const root = project({ app: { '@fonderie/events': '*' }, bricks });
	assert.throws(() => resolveEnv(root), /env conflict on DATABASE_URL: @fonderie\/\w+ declares postgres-url\/(plain|secret), @fonderie\/\w+ declares postgres-url\/(plain|secret)/);
});

test('a brick without env.json is reported, not silently skipped', () => {
	const bricks = standard({ legacy: { pkg: {}, decl: undefined } });
	const root = project({ app: { '@fonderie/legacy': '*' }, bricks });
	assert.deepEqual(resolveEnv(root).undeclared, ['@fonderie/legacy']);
});

test('an installed-but-missing dependency is reported', () => {
	const root = project({ app: { '@fonderie/store': '*' }, bricks: { store: standard().store } });
	assert.deepEqual(resolveBricks(root).missing, ['@fonderie/core']);
});

test('the app-level fonderie.env.json joins the set', () => {
	const root = project({
		app: { '@fonderie/store': '*' },
		bricks: standard(),
		appDecl: { vars: [v('TRIAL_MARKET_COUNTRIES', { kind: 'csv' })] },
	});
	const e = resolveEnv(root).entries.find((x) => x.name === 'TRIAL_MARKET_COUNTRIES');
	assert.deepEqual(e?.declaredBy, ['app']);
});

test('an invalid declaration fails resolution with its location', () => {
	const bricks = standard({ bad: { decl: { vars: [{ name: 'lower' }] } } });
	const root = project({ app: { '@fonderie/bad': '*' }, bricks });
	assert.throws(() => resolveEnv(root), /@fonderie\/bad: vars\[0\] lower: name must be UPPER_SNAKE/);
});

// ── validation ───────────────────────────────────────────────────────────────

test('validateDeclaration: a correct declaration has no problems', () => {
	assert.deepEqual(
		validateDeclaration({
			vars: [
				v('JWT_SECRET', { required: 'always', secret: true, kind: 'secret32', generate: 'base64-32' }),
				v('GOOGLE_CLIENT_ID', { required: 'feature', feature: 'google' }),
				v('VERCEL', { source: 'platform' }),
			],
			features: { google: { description: 'Sign in with Google' } },
		}),
		[],
	);
});

test('validateDeclaration: each rule fires', () => {
	const probs = validateDeclaration({
		vars: [
			v('A', { source: 'env' }),
			v('B', { generate: 'hex-32' }), // not a secret
			v('C', { secret: true, kind: 'secret32', generate: 'hex-32', dev: 'x' }),
			v('D', { required: 'feature' }),
			v('E', { required: 'feature', feature: 'nope' }),
			v('F', { kind: 'number' }),
			v('G', { source: 'platform', dev: '1' }),
			v('A'),
		],
		features: { orphan: { description: 'no vars' } },
	}).join('\n');
	for (const want of [
		/A: source must be/,
		/B: only secrets are generated/,
		/C: "generate" and "dev" are exclusive/,
		/D: required "feature" needs a "feature" name/,
		/E: feature "nope" is not described/,
		/F: kind must be/,
		/G: platform variables are never written/,
		/A: declared twice/,
		/feature "orphan" has no variables/,
	]) {
		assert.match(probs, want);
	}
});

test('validateDeclaration: "vars" must exist even when empty', () => {
	assert.match(validateDeclaration({})[0], /"vars" must be an array/);
	assert.deepEqual(validateDeclaration({ vars: [] }), []);
});

// ── scanner ──────────────────────────────────────────────────────────────────

const names = (src) => scanEnvReads(src).names.map((n) => n.name);

test('scanner: dot, optional-chain and bracket reads', () => {
	assert.deepEqual(names(`const a = process.env.A; const b = process.env['B']; const c = process.env["C"]; const d = process.env?.D;`), ['A', 'B', 'C', 'D']);
});

test('scanner: comments, JSDoc and string contents are not reads', () => {
	const src = [
		'// app.use(cors({ origin: process.env.FRONTEND_URL! }))',
		'/** runWorker(bus, { secret: process.env.WORKER_SECRET }) */',
		"const msg = 'set process.env.IN_STRING first';",
		'const url = "http://x.test"; const real = process.env.REAL;',
	].join('\n');
	assert.deepEqual(names(src), ['REAL']);
});

test('scanner: template literal text is ignored, ${} expressions are code', () => {
	const src = 'const s = `process.env.TEXT ${process.env.EXPR} and ${ { a: 1 }.a } then process.env.AFTER`; const z = process.env.Z;';
	assert.deepEqual(names(src), ['EXPR', 'Z']);
});

test('scanner: the whole object escaping is reported as opaque with its line', () => {
	const src = 'const x = 1;\nexport function f(env = process.env) { return env.X; }\nconst { Y } = process.env;';
	const r = scanEnvReads(src);
	assert.deepEqual(r.names, []);
	assert.deepEqual(r.opaque, [2, 3]);
});

test('blankCommentsAndStrings keeps offsets and newlines', () => {
	const src = "a // c\nb /* x\ny */ 'q'";
	const out = blankCommentsAndStrings(src);
	assert.equal(out.length, src.length);
	assert.equal(out.split('\n').length, src.split('\n').length);
	assert.ok(!/[cxyq]/.test(out));
});
