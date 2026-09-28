// Tests for env declarations: resolution over a fabricated node_modules tree,
// declaration validation, and the process.env source scanner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import {
	blankCommentsAndStrings,
	mergeDotEnv,
	parseEnvFile,
	renderExample,
	isBrick,
	resolveBricks,
	resolveEnv,
	scanEnvReads,
	validateDeclaration,
} from './env.mjs';

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

// ── generation ───────────────────────────────────────────────────────────────


const genBricks = () =>
	standard({
		auth: {
			pkg: { dependencies: { '@fonderie/store': '*' } },
			decl: {
				vars: [
					v('JWT_SECRET', { required: 'always', secret: true, kind: 'secret32', generate: 'base64-32' }),
					v('PASSWORD_RESET_URL', { kind: 'url' }),
					v('GOOGLE_CLIENT_ID', { required: 'feature', feature: 'google' }),
					v('APPLE_REDIRECT_URI', { kind: 'url', deprecatedNames: ['APPLE_CALLBACK_URL'], dev: 'http://localhost/cb' }),
					// Shaped like the real declaration: the renamed variable is a feature var.
					v('GOOGLE_REDIRECT_URI', { required: 'feature', feature: 'google', kind: 'url', deprecatedNames: ['GOOGLE_CALLBACK_URL'] }),
				],
				features: { google: { description: 'Sign in with Google' } },
			},
		},
		core: {
			decl: {
				vars: [
					v('NODE_ENV', { source: 'direct', required: 'production', kind: 'enum:development|test|production', dev: 'development' }),
					v('VERCEL', { source: 'platform' }),
				],
			},
		},
	});
const FIXED = { 'hex-32': () => 'h'.repeat(64), 'base64-32': () => 'b'.repeat(44) };

test('renderExample: one line per variable, the right ones commented, platform never written', () => {
	const r = resolveEnv(project({ app: { '@fonderie/auth': '*', '@fonderie/billing': '*' }, bricks: genBricks() }));
	const ex = renderExample(r);
	assert.match(ex, /^JWT_SECRET=$/m, 'required secret: empty, uncommented');
	assert.match(ex, /^# PASSWORD_RESET_URL=$/m, 'optional without a value: commented');
	assert.match(ex, /^# GOOGLE_CLIENT_ID=$/m, 'feature: commented');
	assert.match(ex, /^NODE_ENV=development$/m, 'dev value shown');
	assert.match(ex, /^DATABASE_URL=$/m);
	assert.ok(!/VERCEL=/.test(ex), 'platform variables are never written');
	assert.match(ex, /Formerly APPLE_CALLBACK_URL/);
	assert.match(ex, /generate: openssl rand -base64 32/);
	assert.match(ex, /── Sign in with Google — @fonderie\/auth/);
	for (const e of r.entries.filter((x) => x.source !== 'platform')) {
		assert.equal(ex.match(new RegExp(`^(# )?${e.name}=`, 'gm'))?.length, 1, `${e.name} listed once`);
	}
	assert.ok(ex.indexOf('@fonderie/core') < ex.indexOf('@fonderie/auth'), 'core first');
	assert.equal(renderExample(r), ex, 'deterministic');
});

test('mergeDotEnv: keeps values and comments, generates, defaults, renames, lists what is left', () => {
	const r = resolveEnv(project({ app: { '@fonderie/auth': '*', '@fonderie/billing': '*' }, bricks: genBricks() }));
	const before = '# mine\nDATABASE_URL=postgres://me@db/x\nAPPLE_CALLBACK_URL=https://old.example/cb\nGOOGLE_CALLBACK_URL=https://old.example/g\n';
	const m = mergeDotEnv(before, r, { generate: FIXED });
	const env = parseEnvFile(m.text);
	assert.ok(m.text.startsWith(before), 'existing content untouched');
	assert.equal(env.get('DATABASE_URL'), 'postgres://me@db/x');
	assert.equal(env.get('JWT_SECRET'), 'b'.repeat(44));
	assert.equal(env.get('NODE_ENV'), 'development');
	assert.equal(env.get('APPLE_REDIRECT_URI'), 'https://old.example/cb', 'deprecated value carried over');
	assert.equal(env.get('GOOGLE_REDIRECT_URI'), 'https://old.example/g', 'carried over even though google is a feature');
	assert.deepEqual(m.renamed.sort(), ['APPLE_CALLBACK_URL → APPLE_REDIRECT_URI', 'GOOGLE_CALLBACK_URL → GOOGLE_REDIRECT_URI']);
	assert.deepEqual(m.mustSupply, ['STRIPE_SECRET_KEY']);
	assert.ok(!env.has('GOOGLE_CLIENT_ID') && !env.has('PASSWORD_RESET_URL') && !env.has('VERCEL'));
	const again = mergeDotEnv(m.text, r, { generate: FIXED });
	assert.equal(again.text, m.text, 'second run changes nothing');
	assert.deepEqual(again.mustSupply, ['STRIPE_SECRET_KEY'], 'an empty required value is still reported');
});

test('mergeDotEnv: real randomness — two projects never share a generated secret', () => {
	const r = resolveEnv(project({ app: { '@fonderie/auth': '*' }, bricks: genBricks() }));
	const a = parseEnvFile(mergeDotEnv('', r).text).get('JWT_SECRET');
	const b = parseEnvFile(mergeDotEnv('', r).text).get('JWT_SECRET');
	assert.equal(Buffer.from(a, 'base64').length, 32);
	assert.notEqual(a, b);
});

// ── the command ──────────────────────────────────────────────────────────────

const bin = join(dirname(fileURLToPath(import.meta.url)), 'fonderie.mjs');
const cli = (cwd, ...args) => spawnSync('node', [bin, 'env', ...args, '--project', cwd], { encoding: 'utf8' });

test('fonderie env generate: writes both files, --check passes, then catches drift', () => {
	const root = project({ app: { '@fonderie/auth': '*', '@fonderie/billing': '*' }, bricks: genBricks() });
	const r = cli(root, 'generate');
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /Still yours to fill in .env[\s\S]*STRIPE_SECRET_KEY/);
	assert.ok(existsSync(join(root, '.env')) && existsSync(join(root, '.env.example')));
	assert.equal(cli(root, 'generate', '--check').status, 0);
	writeFileSync(join(root, '.env.example'), 'DATABASE_URL=\n');
	const drift = cli(root, 'generate', '--check');
	assert.equal(drift.status, 1);
	assert.match(drift.stderr, /out of date/);
});

test('fonderie env generate: refuses to write secrets into a .env git would track', () => {
	const root = project({ app: { '@fonderie/auth': '*' }, bricks: genBricks() });
	execFileSync('git', ['init', '-q'], { cwd: root });
	const r = cli(root, 'generate');
	assert.equal(r.status, 1);
	assert.match(r.stderr, /not gitignored/);
	assert.ok(!existsSync(join(root, '.env')) && !existsSync(join(root, '.env.example')), 'nothing written');
	writeFileSync(join(root, '.gitignore'), '.env\n');
	assert.equal(cli(root, 'generate').status, 0);
	assert.ok(existsSync(join(root, '.env')));
});

test('fonderie env generate against the REAL bricks of this repo', () => {
	const packages = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
	const root = mkdtempSync(join(tmpdir(), 'fonderie-env-real-'));
	mkdirSync(join(root, 'node_modules', '@fonderie'), { recursive: true });
	for (const p of ['core', 'store', 'events', 'auth', 'rate-limit', 'adapter-express', 'workspaces', 'permissions', 'billing']) {
		symlinkSync(join(packages, p), join(root, 'node_modules', '@fonderie', p), 'dir');
	}
	writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { '@fonderie/adapter-express': '*', '@fonderie/auth': '*', '@fonderie/store': '*' } }));
	const r = cli(root, 'generate');
	assert.equal(r.status, 0, r.stderr);
	const env = parseEnvFile(readFileSync(join(root, '.env'), 'utf8'));
	assert.equal(Buffer.from(env.get('JWT_SECRET'), 'base64').length, 32);
	// events is an optional peer of auth: not installed here, so not asked for.
	assert.ok(!env.has('EVENTS_INTEGRITY_KEY'));
	// Installing it (as `fonderie add auth` does) brings its key, generated.
	writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { '@fonderie/adapter-express': '*', '@fonderie/auth': '*', '@fonderie/events': '*' } }));
	assert.equal(cli(root, 'generate').status, 0);
	const env2 = parseEnvFile(readFileSync(join(root, '.env'), 'utf8'));
	assert.match(env2.get('EVENTS_INTEGRITY_KEY'), /^[0-9a-f]{64}$/);
	assert.equal(env2.get('JWT_SECRET'), env.get('JWT_SECRET'), 'existing secret kept on re-run');
	const ex = readFileSync(join(root, '.env.example'), 'utf8');
	assert.ok(!/STRIPE_SECRET_KEY/.test(ex), 'billing is an optional adapter peer the app did not install');
	assert.match(ex, /^DATABASE_URL=postgres:\/\/localhost:5432\/app$/m);
});

test('the CLI and frontend packages are not bricks: not walked, not reported as undeclared', () => {
	const bricks = standard({ cli: { decl: undefined }, 'react-auth': { pkg: { dependencies: { '@fonderie/client': '*' } }, decl: undefined }, client: { decl: undefined } });
	const root = project({ app: { '@fonderie/cli': '*', '@fonderie/react-auth': '*', '@fonderie/store': '*' }, bricks });
	const r = resolveEnv(root);
	assert.deepEqual(r.undeclared, []);
	assert.deepEqual(r.bricks.sort(), ['@fonderie/core', '@fonderie/store']);
	for (const n of ['cli', 'client', 'react', 'react-auth', 'vue-billing-screens', 'create-fonderie-app']) assert.equal(isBrick(`@fonderie/${n}`), false, n);
	for (const n of ['core', 'auth', 'adapter-hono', 'rate-limit']) assert.equal(isBrick(`@fonderie/${n}`), true, n);
});
