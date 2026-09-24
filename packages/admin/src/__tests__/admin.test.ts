import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IAdminCheck, IAdminRoute, IFonderieApp, IFonderieModule } from '@fonderie/core';

import { AdminModule } from '../module';
import type {
	IAdminAttention,
	IAdminDoctorReport,
	IAdminManifest,
	IAdminMigrationModule,
	IAdminMigrationsReport,
	IAdminPendingMigration,
} from '../types';

// ≥32 chars, no placeholder words, low entropy so the secret scanner ignores it.
const TOKEN = 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb';
const config = defineConfig({ db: { url: 'postgres://localhost/test' } });
const ok = async () => Response.json({ ok: true });

function get(app: FonderieApp, path: string, token?: string): Promise<Response> {
	return app.handle(
		new Request(`http://localhost${path}`, {
			headers: token ? { authorization: `Bearer ${token}` } : {},
		}),
	);
}

async function manifest(app: FonderieApp, path = '/_admin'): Promise<IAdminManifest> {
	const res = await get(app, `${path}/manifest`, TOKEN);
	assert.equal(res.status, 200);
	return ((await res.json()) as { result: IAdminManifest }).result;
}

function brick(
	name: string,
	install: (app: IFonderieApp) => void,
	extra: Partial<IFonderieModule> = {},
): IFonderieModule {
	return { name, install, ...extra };
}

// ── fail-closed ─────────────────────────────────────────────────────

test('no adminToken: the surface does not exist', async () => {
	const app = new FonderieApp(config).register(new AdminModule());
	await app.boot();
	assert.equal((await get(app, '/_admin/manifest', TOKEN)).status, 404);
	assert.equal(
		app.routes().some((r) => r.path.startsWith('/_admin')),
		false,
	);
});

test('missing and wrong tokens are the same 401', async () => {
	const app = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();
	const missing = await get(app, '/_admin/manifest');
	const wrong = await get(app, '/_admin/manifest', 'nope');
	assert.equal(missing.status, 401);
	assert.equal(wrong.status, 401);
	assert.deepEqual(await missing.json(), await wrong.json());
});

test('checkReadiness flags a weak token; no token is nothing to flag', () => {
	assert.equal(new AdminModule({ adminToken: 'changeme' }).checkReadiness()[0]?.severity, 'error');
	assert.deepEqual(new AdminModule().checkReadiness(), []);
	assert.deepEqual(new AdminModule({ adminToken: TOKEN }).checkReadiness(), []);
});

// ── the manifest ────────────────────────────────────────────────────

test('manifest: modules with versions and readiness, aggregate readiness, the route table', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1' }));
	app.register(
		brick('@acme/versioned', (a) => a.addRoute('GET', '/things', ok), { version: '1.2.3' }),
	);
	app.register(
		brick('@acme/unwell', () => {}, {
			checkReadiness: () => [
				{ module: '@acme/unwell', severity: 'warning', message: 'no encryptor' },
			],
		}),
	);
	app.register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();

	const m = await manifest(app, '/v1/_admin');

	assert.equal(typeof m.admin.version, 'string');
	assert.deepEqual(
		m.modules.map((x) => [x.name, x.version, x.readiness.ok, x.readiness.problems.length]),
		[
			['@acme/unwell', null, true, 1],
			['@acme/versioned', '1.2.3', true, 0],
			['@fonderie/admin', m.admin.version, true, 0],
		],
	);
	assert.equal(m.readiness.ok, true);
	assert.equal(m.readiness.problems.length, 1);
	assert.deepEqual(
		m.routes.map((r) => [r.method, r.path, r.module]),
		[
			['GET', '/v1/things', '@acme/versioned'],
			['GET', '/v1/_admin', '@fonderie/admin'],
			['GET', '/v1/_admin/manifest', '@fonderie/admin'],
			['GET', '/v1/_admin/doctor', '@fonderie/admin'],
			['GET', '/v1/_admin/environment', '@fonderie/admin'],
			['GET', '/v1/_admin/routes', '@fonderie/admin'],
			['GET', '/v1/_admin/access/tokens', '@fonderie/admin'],
			['GET', '/healthz', '@fonderie/core'],
			['GET', '/readyz', '@fonderie/core'],
		],
	);
});

test('manifest: readiness problems are shown even in production — the operator is the audience', async () => {
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'production';
	try {
		const app = new FonderieApp(config);
		app.register(
			brick('@acme/unwell', () => {}, {
				checkReadiness: () => [
					{ module: '@acme/unwell', severity: 'warning', message: 'no encryptor' },
				],
			}),
		);
		app.register(new AdminModule({ adminToken: TOKEN }));
		await app.boot();
		const m = await manifest(app);
		assert.equal(m.env, 'production');
		assert.equal(
			m.modules.find((x) => x.name === '@acme/unwell')?.readiness.problems[0]?.message,
			'no encryptor',
		);
		// /readyz still hides them from the public.
		const ready = (await (await get(app, '/readyz')).json()) as { problems?: unknown };
		assert.equal('problems' in ready, false);
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV'];
		else process.env['NODE_ENV'] = prev;
	}
});

// ── the namespace ───────────────────────────────────────────────────

test('the prefix is reserved: another module cannot mount under it', async () => {
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN }));
	app.register(
		brick('@acme/squatter', (a) => a.addRoute('GET', '/_admin/mine', ok), {
			deps: ['@fonderie/admin'],
		}),
	);
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/@acme\/squatter cannot mount GET \/_admin\/mine.*reserved by @fonderie\/admin/.test(
				err.message,
			),
	);
});

test('a configured path moves the whole surface and is reserved instead', async () => {
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN, path: '/ops/' }));
	app.register(brick('@acme/free', (a) => a.addRoute('GET', '/_admin/free', ok)));
	await app.boot();
	await manifest(app, '/ops');
	assert.equal((await get(app, '/_admin/manifest', TOKEN)).status, 404);
	assert.equal((await get(app, '/_admin/free')).status, 200);
});

// ── composition ─────────────────────────────────────────────────────

const describing = (name: string, routes: IAdminRoute[]): IFonderieModule => ({
	name,
	install: () => {},
	describeAdmin: () => ({ routes }),
});

test('described routes are mounted under the prefix, behind the admin guard, with params and chains intact', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1' }));
	const seen: string[] = [];
	app.register(
		describing('@acme/things', [
			{
				method: 'GET',
				path: '/things/:id',
				handlers: [
					async (ctx, next) => {
						seen.push('first');
						return next();
					},
					async (ctx) => Response.json({ id: ctx.meta.params?.['id'] }),
				],
			},
		]),
	);
	app.register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();

	assert.equal((await get(app, '/v1/_admin/things/42')).status, 401);
	const res = await get(app, '/v1/_admin/things/42', TOKEN);
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { id: '42' });
	assert.deepEqual(seen, ['first']);
	assert.deepEqual(
		app.routes().find((r) => r.path === '/v1/_admin/things/:id'),
		{ method: 'GET', path: '/v1/_admin/things/:id', module: '@fonderie/admin' },
	);
});

test('two modules describing the same route fail boot, naming both', async () => {
	const app = new FonderieApp(config);
	app.register(describing('@acme/a', [{ method: 'get', path: '/dup', handlers: [ok] }]));
	app.register(describing('@acme/b', [{ method: 'GET', path: '/dup', handlers: [ok] }]));
	app.register(new AdminModule({ adminToken: TOKEN }));
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/@acme\/b cannot describe GET \/_admin\/dup: @acme\/a already describes it/.test(err.message),
	);
});

test('a description is read even from a module that installs after admin', async () => {
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN }));
	app.register(describing('@acme/late', [{ method: 'GET', path: '/late', handlers: [ok] }]));
	await app.boot();
	assert.equal((await get(app, '/_admin/late', TOKEN)).status, 200);
});

test('manifest: describesAdmin says which modules offer routes', async () => {
	const app = new FonderieApp(config);
	app.register(describing('@acme/yes', []));
	app.register(brick('@acme/no', () => {}));
	app.register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();
	const m = await manifest(app);
	assert.deepEqual(
		m.modules.map((x) => [x.name, x.describesAdmin]),
		[
			['@acme/no', false],
			['@acme/yes', true],
			['@fonderie/admin', false],
		],
	);
});

// ── doctor ──────────────────────────────────────────────────────────

const checking = (name: string, checks: IAdminCheck[]): IFonderieModule => ({
	name,
	install: () => {},
	describeAdmin: () => ({ checks }),
});
const report =
	(ok: boolean, findings: string[] = [], skipped?: string): IAdminCheck['run'] =>
	async () =>
		skipped ? { ok, findings, skipped } : { ok, findings };

async function doctor(app: FonderieApp): Promise<IAdminDoctorReport> {
	const res = await get(app, '/_admin/doctor', TOKEN);
	assert.equal(res.status, 200);
	return ((await res.json()) as { result: IAdminDoctorReport }).result;
}

test('doctor: runs module and app checks, keeps skipped, never throws, times out', async () => {
	const app = new FonderieApp(config);
	app.register(
		checking('@acme/money', [
			{ name: 'money.drift', run: report(false, ['a: ours=active theirs=canceled']) },
			{ name: 'money.prices', run: report(true, [], 'the provider cannot be asked') },
		]),
	);
	app.register(checking('@acme/mail', [{ name: 'mail.dns', run: report(true, ['DMARC p=none']) }]));
	app.register(
		new AdminModule({
			adminToken: TOKEN,
			checkTimeoutMs: 30,
			checks: [
				{ name: 'app.migrations', run: report(true) },
				{
					name: 'app.throws',
					run: async () => {
						throw new Error('boom');
					},
				},
				{
					name: 'app.slow',
					run: () => new Promise((r) => setTimeout(() => r({ ok: true, findings: [] }), 200)),
				},
			],
		}),
	);
	await app.boot();

	assert.equal((await get(app, '/_admin/doctor')).status, 401);
	const d = await doctor(app);
	assert.equal(d.ok, false);
	assert.deepEqual(
		d.checks.map((c) => [c.name, c.module, c.ok, c.findings, c.skipped ?? null]),
		[
			['mail.dns', '@acme/mail', true, ['DMARC p=none'], null],
			['money.drift', '@acme/money', false, ['a: ours=active theirs=canceled'], null],
			['money.prices', '@acme/money', true, [], 'the provider cannot be asked'],
			['app.migrations', 'application', true, [], null],
			['app.throws', 'application', false, ['check threw: boom'], null],
			['app.slow', 'application', false, ['timed out after 30 ms'], null],
		],
	);
	assert.ok(d.checks.every((c) => typeof c.durationMs === 'number'));
});

test('doctor: two modules offering one check name fail boot, naming both', async () => {
	const app = new FonderieApp(config);
	app.register(checking('@acme/a', [{ name: 'same', run: report(true) }]));
	app.register(checking('@acme/b', [{ name: 'same', run: report(true) }]));
	app.register(new AdminModule({ adminToken: TOKEN }));
	await assert.rejects(
		() => app.boot(),
		(err: Error) => /@acme\/b cannot offer check "same": @acme\/a already does/.test(err.message),
	);
});

test('attention: readiness + doctor, errors vs advice, skipped is silent, empty is green', async () => {
	const app = new FonderieApp(config);
	app.register(
		brick('@acme/unwell', () => {}, {
			checkReadiness: () => [
				{ module: '@acme/unwell', severity: 'warning', message: 'no encryptor' },
			],
		}),
	);
	app.register(
		checking('@acme/money', [
			{ name: 'money.drift', run: report(false, ['x drifted']) },
			{ name: 'money.prices', run: report(true, [], 'skipped') },
			{ name: 'money.hooks', run: report(true, ['api version differs']) },
			{ name: 'money.silent-fail', run: report(false) },
		]),
	);
	app.register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();

	const res = await get(app, '/_admin', TOKEN);
	assert.equal(res.status, 200);
	const a = ((await res.json()) as { result: IAdminAttention }).result;
	assert.equal(a.ok, false);
	assert.deepEqual(
		a.items.map((i) => [i.source, i.severity, i.message]),
		[
			['@acme/unwell', 'advice', 'no encryptor'],
			['money.drift', 'error', 'x drifted'],
			['money.hooks', 'advice', 'api version differs'],
			['money.silent-fail', 'error', 'failed'],
		],
	);

	const green = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN }));
	await green.boot();
	const g = ((await (await get(green, '/_admin', TOKEN)).json()) as { result: IAdminAttention })
		.result;
	assert.deepEqual([g.ok, g.items], [true, []]);
});

// ── admin log ───────────────────────────────────────────────────────

import type { IStoreAdapter } from '@fonderie/store';
import type { IAdminLogEntry, IAdminLogPage } from '../types';

function captureStore(opts: { failWrites?: boolean; rows?: IAdminLogEntry[] } = {}) {
	const inserts: unknown[][] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			if (sql.includes('INSERT INTO fonderie_admin_log')) {
				if (opts.failWrites) throw new Error('disk full');
				inserts.push(params);
				return [];
			}
			if (sql.includes('FROM fonderie_admin_log')) return (opts.rows ?? []) as unknown as T[];
			return [];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, inserts };
}

test('admin log: every request through the surface is a row — served and refused alike', async () => {
	const { store, inserts } = captureStore();
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1' }));
	app.register(
		describing('@acme/things', [{ method: 'GET', path: '/things/:id', handlers: [ok] }]),
	);
	app.register(new AdminModule({ adminToken: TOKEN, store }));
	await app.boot();

	await app.handle(
		new Request('http://localhost/v1/_admin/things/42?x=1', {
			headers: { authorization: `Bearer ${TOKEN}`, 'x-actor': 'louis' },
		}),
	);
	await get(app, '/v1/_admin/manifest', 'wrong-token');

	assert.equal(inserts.length, 2);
	const [served, refused] = inserts as [unknown[], unknown[]];
	// actor, method, path, route, module, status
	assert.deepEqual(served.slice(0, 6), [
		'louis',
		'GET',
		'/v1/_admin/things/42',
		'/_admin/things/:id',
		'@acme/things',
		200,
	]);
	assert.deepEqual(refused.slice(0, 6), [
		'admin-token',
		'GET',
		'/v1/_admin/manifest',
		'/_admin/manifest',
		'@fonderie/admin',
		401,
	]);
	assert.equal(typeof served[6], 'number'); // durationMs
});

test('admin log: a failed write never fails the request it describes', async () => {
	const { store } = captureStore({ failWrites: true });
	const app = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN, store }));
	await app.boot();
	const errors: unknown[] = [];
	const orig = console.error;
	console.error = (...a: unknown[]) => {
		errors.push(a);
	};
	try {
		assert.equal((await get(app, '/_admin/manifest', TOKEN)).status, 200);
	} finally {
		console.error = orig;
	}
	assert.equal(errors.length, 1);
});

test('admin log: readable at /_admin/activity/admin-log, paged newest first; absent without a store', async () => {
	const rows: IAdminLogEntry[] = Array.from({ length: 3 }, (_, i) => ({
		id: `00000000-0000-0000-0000-00000000000${i}`,
		at: new Date(Date.UTC(2026, 8, 21, 12, 0, i)).toISOString(),
		actor: 'admin-token',
		method: 'GET',
		path: '/_admin/manifest',
		route: '/_admin/manifest',
		module: '@fonderie/admin',
		status: 200,
		durationMs: 1,
		requestId: null,
		clientIp: null,
	}));
	const { store } = captureStore({ rows });
	const app = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN, store }));
	await app.boot();

	const res = await get(app, '/_admin/activity/admin-log?limit=2', TOKEN);
	assert.equal(res.status, 200);
	const page = ((await res.json()) as { result: IAdminLogPage }).result;
	assert.equal(page.entries.length, 2);
	assert.ok(page.next, 'a third row means there is a next page');
	const m = await manifest(app);
	assert.equal(m.admin.log, true);

	const bare = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN }));
	await bare.boot();
	assert.equal((await get(bare, '/_admin/activity/admin-log', TOKEN)).status, 404);
	assert.equal((await manifest(bare)).admin.log, false);
});

// ── config · routes · tokens ────────────────────────────────────────

import type { IAdminEnvironmentReport, IAdminRoutesReport, IAdminTokensReport } from '../types';

async function page<T>(app: FonderieApp, path: string): Promise<T> {
	const res = await get(app, path, TOKEN);
	assert.equal(res.status, 200);
	return ((await res.json()) as { result: T }).result;
}

test('config: readiness per module and env presence — names only, never values', async () => {
	process.env['ADMIN_TEST_SET'] = 'a-value';
	process.env['ADMIN_TEST_EMPTY'] = '';
	delete process.env['ADMIN_TEST_MISSING'];
	try {
		const app = new FonderieApp(config);
		app.register(
			brick('@acme/unwell', () => {}, {
				checkReadiness: () => [
					{ module: '@acme/unwell', severity: 'warning', message: 'no encryptor' },
				],
			}),
		);
		app.register(brick('@acme/fine', () => {}));
		app.register(
			new AdminModule({
				adminToken: TOKEN,
				env: ['ADMIN_TEST_SET', 'ADMIN_TEST_EMPTY', 'ADMIN_TEST_MISSING'],
			}),
		);
		await app.boot();
		const c = await page<IAdminEnvironmentReport>(app, '/_admin/environment');
		assert.deepEqual(
			c.modules.map((m) => [m.name, m.problems.length]),
			[
				['@acme/fine', 0],
				['@acme/unwell', 1],
				['@fonderie/admin', 0],
			],
		);
		assert.deepEqual(c.env, [
			{ name: 'ADMIN_TEST_SET', set: true },
			{ name: 'ADMIN_TEST_EMPTY', set: false },
			{ name: 'ADMIN_TEST_MISSING', set: false },
		]);
		assert.equal(JSON.stringify(c).includes('a-value'), false);
	} finally {
		delete process.env['ADMIN_TEST_SET'];
		delete process.env['ADMIN_TEST_EMPTY'];
	}
});

test('routes: every route with a guard class — admin, probe, or app', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, metrics: true }));
	app.register(brick('@acme/things', (a) => a.addRoute('GET', '/things', ok)));
	app.register(describing('@acme/desc', [{ method: 'POST', path: '/desc', handlers: [ok] }]));
	app.register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();
	const r = await page<IAdminRoutesReport>(app, '/_admin/routes');
	const guard = (path: string) => r.routes.find((x) => x.path === path)?.guard;
	assert.equal(guard('/things'), 'app');
	assert.equal(guard('/_admin/desc'), 'admin');
	assert.equal(guard('/_admin/routes'), 'admin');
	assert.equal(guard('/healthz'), 'probe');
	assert.equal(guard('/metrics'), 'probe');
	assert.equal(r.routes.length, app.routes().length);
});

test('tokens: the admin token verdict, and which bricks still carry a legacy token', async () => {
	const app = new FonderieApp(config);
	// A brick with a legacy standalone admin surface registered (token set).
	app.register(brick('@acme/config-like', (a) => a.addRoute('GET', '/admin/config', ok)));
	app.register(brick('@acme/billing-like', (a) => a.addRoute('POST', '/plans', ok)));
	// GET /plans is public; a brick with only that has no legacy token.
	app.register(brick('@acme/reader', (a) => a.addRoute('GET', '/plans', ok)));
	app.register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();
	const t = await page<IAdminTokensReport>(app, '/_admin/access/tokens');
	assert.deepEqual(t.admin, { ok: true, problems: [] });
	assert.deepEqual(t.legacy, [
		{ module: '@acme/billing-like', set: true },
		{ module: '@acme/config-like', set: true },
	]);
});

// ── scoped tokens ───────────────────────────────────────────────────

import { hashToken, grants, scopeFor } from '../tokens';
import type { IAdminTokenRecord } from '../types';

test('scopeFor / grants: derived from the route; write implies read; secrets implies all', () => {
	assert.equal(scopeFor('GET', '/_admin/config'), 'read');
	assert.equal(scopeFor('put', '/_admin/config/k'), 'write');
	assert.equal(scopeFor('GET', '/_admin/secrets'), 'secrets');
	assert.equal(scopeFor('POST', '/_admin/secrets/k/reveal'), 'secrets');
	assert.equal(grants(['read'], 'read'), true);
	assert.equal(grants(['read'], 'write'), false);
	assert.equal(grants(['write'], 'read'), true);
	assert.equal(grants(['write'], 'secrets'), false);
	assert.equal(grants(['secrets'], 'write'), true);
});

function tokenStore() {
	const rows: Array<IAdminTokenRecord & { tokenHash: string }> = [];
	const inserts: unknown[][] = [];
	let n = 0;
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			if (sql.includes('INSERT INTO fonderie_admin_log')) {
				inserts.push(params);
				return [];
			}
			if (sql.includes('INSERT INTO fonderie_admin_tokens')) {
				const rec = {
					id: `t${++n}`,
					name: params[0] as string,
					tokenHash: params[1] as string,
					scopes: params[2] as IAdminTokenRecord['scopes'],
					createdBy: params[3] as string,
					createdAt: new Date().toISOString(),
					expiresAt: params[4] ? new Date(params[4] as Date).toISOString() : null,
					revokedAt: null,
					lastUsedAt: null,
				};
				rows.push(rec);
				return [rec] as unknown as T[];
			}
			if (sql.includes('FROM fonderie_admin_tokens') && sql.includes('token_hash = $1')) {
				const r = rows.find(
					(x) =>
						x.tokenHash === params[0] &&
						!x.revokedAt &&
						(!x.expiresAt || new Date(x.expiresAt) > new Date()),
				);
				return (r ? [r] : []) as unknown as T[];
			}
			// The real SELECT projects explicit columns; the hash never leaves the table.
			if (sql.includes('FROM fonderie_admin_tokens'))
				return rows.map(({ tokenHash: _h, ...r }) => r) as unknown as T[];
			if (sql.includes('SET revoked_at')) {
				const r = rows.find((x) => x.id === params[0] && !x.revokedAt);
				if (r) r.revokedAt = new Date().toISOString();
				return (r ? [{ id: r.id }] : []) as unknown as T[];
			}
			if (sql.includes('SET last_used_at')) return [];
			if (sql.includes('FROM fonderie_admin_log')) return [];
			return [];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, rows, inserts };
}

test('scoped tokens: root issues; read is 403 on writes and secrets; revoke ⇒ 401; expired ⇒ 401; name is the log actor', async () => {
	const { store, rows, inserts } = tokenStore();
	const app = new FonderieApp(config);
	app.register(
		describing('@acme/x', [
			{ method: 'GET', path: '/things', handlers: [ok] },
			{ method: 'POST', path: '/things', handlers: [ok] },
			{ method: 'POST', path: '/secrets/k/reveal', handlers: [ok] },
		]),
	);
	app.register(new AdminModule({ adminToken: TOKEN, store }));
	await app.boot();
	const call = (method: string, path: string, token?: string, body?: unknown) =>
		app.handle(
			new Request(`http://localhost${path}`, {
				method,
				headers: {
					...(token ? { authorization: `Bearer ${token}` } : {}),
					'content-type': 'application/json',
				},
				...(body ? { body: JSON.stringify(body) } : {}),
			}),
		);

	// Root issues a read token (and a bad body is 422).
	assert.equal(
		(await call('POST', '/_admin/access/tokens', TOKEN, { name: 'x', scopes: ['nope'] })).status,
		422,
	);
	const issued = await call('POST', '/_admin/access/tokens', TOKEN, {
		name: 'dashboard',
		scopes: ['read'],
	});
	assert.equal(issued.status, 201);
	const {
		token: readToken,
		id,
		scopes,
	} = ((await issued.json()) as { result: { token: string; id: string; scopes: string[] } }).result;
	assert.match(readToken, /^fad_/);
	assert.deepEqual(scopes, ['read']);
	assert.equal(rows[0]?.tokenHash, hashToken(readToken), 'only the hash is stored');

	// The read token reads, cannot write, cannot reveal, cannot mint.
	assert.equal((await call('GET', '/_admin/things', readToken)).status, 200);
	assert.equal((await call('GET', '/_admin/manifest', readToken)).status, 200);
	assert.equal((await call('POST', '/_admin/things', readToken)).status, 403);
	assert.equal((await call('POST', '/_admin/secrets/k/reveal', readToken)).status, 403);
	assert.equal(
		(await call('POST', '/_admin/access/tokens', readToken, { name: 'y', scopes: ['read'] }))
			.status,
		401,
	);
	assert.equal((await call('DELETE', `/_admin/access/tokens/${id}`, readToken)).status, 401);
	// The token names itself in the log on the requests it was allowed through;
	// a refused root-only request never learns the name and stays 'admin-token'.
	const served = inserts.find((r) => r[3] === '/_admin/things' && r[5] === 200);
	assert.equal(served?.[0], 'token:dashboard');
	assert.equal(inserts.at(-1)?.[0], 'admin-token');

	// Listed without secrets; revoked by root; then 401.
	const list = (
		(await (await call('GET', '/_admin/access/tokens', TOKEN)).json()) as {
			result: { issued: Array<Record<string, unknown>> };
		}
	).result.issued;
	assert.equal(list.length, 1);
	assert.equal('tokenHash' in (list[0] ?? {}) || 'token' in (list[0] ?? {}), false);
	assert.equal((await call('DELETE', `/_admin/access/tokens/${id}`, TOKEN)).status, 200);
	assert.equal((await call('GET', '/_admin/things', readToken)).status, 401);
	assert.equal((await call('DELETE', `/_admin/access/tokens/${id}`, TOKEN)).status, 404);

	// A write token writes but does not reveal; an expired token is 401.
	const w = (
		(await (
			await call('POST', '/_admin/access/tokens', TOKEN, {
				name: 'ops',
				scopes: ['write'],
				expiresInDays: 1,
			})
		).json()) as { result: { token: string } }
	).result.token;
	assert.equal((await call('POST', '/_admin/things', w)).status, 200);
	assert.equal((await call('POST', '/_admin/secrets/k/reveal', w)).status, 403);
	rows[1]!.expiresAt = new Date(Date.now() - 1000).toISOString();
	assert.equal((await call('GET', '/_admin/things', w)).status, 401);
	// Unknown tokens are the same 401 as missing ones.
	assert.equal((await call('GET', '/_admin/things', 'fad_nope')).status, 401);
	assert.equal((await call('GET', '/_admin/things')).status, 401);
});

test('scoped tokens: without a store, only the root token works and the routes do not exist', async () => {
	const app = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();
	assert.equal((await get(app, '/_admin/access/tokens', TOKEN)).status, 200);
	assert.equal(
		(
			(await (await get(app, '/_admin/access/tokens', TOKEN)).json()) as {
				result: { issued: unknown };
			}
		).result.issued,
		null,
	);
	assert.equal(
		(
			await app.handle(
				new Request('http://localhost/_admin/access/tokens', {
					method: 'POST',
					headers: { authorization: `Bearer ${TOKEN}` },
				}),
			)
		).status,
		404,
	);
	assert.equal((await get(app, '/_admin/manifest', 'fad_whatever')).status, 401);
});

// ── the served dashboard ────────────────────────────────────────────

test('ui: off by default; on serves the page UNGUARDED with an absolute script path', async () => {
	const off = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN }));
	await off.boot();
	assert.equal((await get(off, '/_admin/ui', TOKEN)).status, 404);

	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1' }));
	app.register(new AdminModule({ adminToken: TOKEN, ui: true, path: '/ops' }));
	await app.boot();

	// No token: a browser navigating to a page cannot send an Authorization
	// header, so the shell itself must be reachable without one.
	const page = await app.handle(new Request('http://localhost/v1/ops/ui'));
	assert.equal(page.status, 200);
	assert.match(page.headers.get('content-type') ?? '', /text\/html/);
	const html = await page.text();
	// Absolute, basePath- and path-aware: a relative src breaks on a trailing slash.
	assert.match(html, /<script src="\/v1\/ops\/ui\/app\.js" defer>/);
	assert.match(html, /noindex/);
	assert.equal(html.includes(TOKEN), false, 'the page never carries a token');

	// A trailing slash must not shift the script one segment deeper, which is
	// exactly what a relative src would do.
	const slashed = await (await app.handle(new Request('http://localhost/v1/ops/ui/'))).text();
	assert.match(slashed, /<script src="\/v1\/ops\/ui\/app\.js" defer>/);

	// The script route exists and is unguarded too. Running from source there is
	// no built bundle, so it says so rather than 404ing or crashing at boot.
	const js = await app.handle(new Request('http://localhost/v1/ops/ui/app.js'));
	assert.equal(js.status, 503);
	assert.match(((await js.json()) as { reason: string }).reason, /UI_NOT_BUILT/);

	// Everything else under the prefix is still guarded.
	assert.equal((await app.handle(new Request('http://localhost/v1/ops/manifest'))).status, 401);
});

test('ui: the two static routes are attributed to admin and add nothing to the guarded set', async () => {
	const app = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN, ui: true }));
	await app.boot();
	const ui = app.routes().filter((r) => r.path.startsWith('/_admin/ui'));
	assert.deepEqual(
		ui.map((r) => [r.method, r.path, r.module]),
		[
			['GET', '/_admin/ui', '@fonderie/admin'],
			['GET', '/_admin/ui/app.js', '@fonderie/admin'],
		],
	);
});

// ── host binding ────────────────────────────────────────────────────

const at = (host: string, path: string, token?: string) =>
	new Request(`https://${host}${path}`, {
		headers: token ? { authorization: `Bearer ${token}` } : {},
	});

test('host: bound surface answers on its hostname and looks unmounted elsewhere', async () => {
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN, host: 'admin.example.com' }));
	await app.boot();

	// The right host: exists, and still demands a token.
	assert.equal((await app.handle(at('admin.example.com', '/_admin/manifest', TOKEN))).status, 200);
	assert.equal((await app.handle(at('admin.example.com', '/_admin/manifest'))).status, 401);

	// The wrong host — including the platform's own deployment URL, which is the
	// hole this closes: 404, the same as never mounted. Not 403: that would
	// confirm both that the surface exists and that you found the wrong door.
	for (const wrong of ['api.example.com', 'project-a1b2c3.vercel.app']) {
		const res = await app.handle(at(wrong, '/_admin/manifest', TOKEN));
		assert.equal(res.status, 404, wrong);
		const body = (await res.json()) as { reason: string };
		assert.equal(body.reason, 'NOT_FOUND', wrong);
	}

	// A non-default port still matches the bare hostname; ports are not a
	// boundary here. Case is irrelevant, as Host headers are case-insensitive.
	assert.equal(
		(await app.handle(at('admin.example.com:8443', '/_admin/manifest', TOKEN))).status,
		200,
	);
	assert.equal((await app.handle(at('ADMIN.example.com', '/_admin/manifest', TOKEN))).status, 200);
});

test('host: a list is honoured, and an exact host:port entry stays exact', async () => {
	const app = new FonderieApp(config);
	app.register(
		new AdminModule({ adminToken: TOKEN, host: ['admin.example.com', 'localhost:3000'] }),
	);
	await app.boot();
	assert.equal((await app.handle(at('admin.example.com', '/_admin/manifest', TOKEN))).status, 200);
	assert.equal((await app.handle(at('localhost:3000', '/_admin/manifest', TOKEN))).status, 200);
	// 'localhost:3000' was configured with a port, so bare localhost is not it.
	assert.equal((await app.handle(at('localhost', '/_admin/manifest', TOKEN))).status, 404);
});

test('host: a scheme or trailing path in the config still names the host', async () => {
	// This option sits next to ones that ARE full URLs, so a scheme here is the
	// likely slip. Unnormalized it matches no Host header at all, and the whole
	// surface 404s exactly as if it had never been mounted — a silent lockout
	// from a typo. Every spelling below names the same host.
	for (const spelling of [
		'https://admin.example.com',
		'http://admin.example.com/',
		'admin.example.com/',
		'  ADMIN.example.com  ',
	]) {
		const app = new FonderieApp(config);
		app.register(new AdminModule({ adminToken: TOKEN, host: spelling }));
		await app.boot();
		assert.equal(
			(await app.handle(at('admin.example.com', '/_admin/manifest', TOKEN))).status,
			200,
			spelling,
		);
		// Still a real boundary — normalising the spelling must not widen it.
		assert.equal(
			(await app.handle(at('api.example.com', '/_admin/manifest', TOKEN))).status,
			404,
			spelling,
		);
	}
});

test('host: a wrong-host attempt is still logged — the caller learns nothing, the operator does', async () => {
	const { store, inserts } = tokenStore();
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN, store, host: 'admin.example.com' }));
	await app.boot();
	await app.handle(at('api.example.com', '/_admin/manifest', TOKEN));
	const row = inserts.at(-1);
	assert.equal(row?.[2], '/_admin/manifest', 'the path they tried');
	assert.equal(row?.[5], 404, 'what they were told');

	// Only routes that EXIST reach the log: a wrong-host request to a path this
	// deployment never mounted is a plain router miss, with nothing to record.
	const before = inserts.length;
	await app.handle(at('api.example.com', '/_admin/not-a-route', TOKEN));
	assert.equal(inserts.length, before);
});

test('host: the served UI is bound too, and the manifest reports the binding', async () => {
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN, ui: true, host: 'admin.example.com' }));
	await app.boot();
	// Serving a page that says "admin" on the public API hostname is exactly
	// what binding exists to prevent, so the unguarded assets respect it too.
	assert.equal((await app.handle(at('admin.example.com', '/_admin/ui'))).status, 200);
	assert.equal((await app.handle(at('api.example.com', '/_admin/ui'))).status, 404);
	assert.equal((await app.handle(at('api.example.com', '/_admin/ui/app.js'))).status, 404);

	const m = (
		(await (await app.handle(at('admin.example.com', '/_admin/manifest', TOKEN))).json()) as {
			result: IAdminManifest;
		}
	).result;
	assert.deepEqual(m.admin.host, ['admin.example.com']);

	// Unbound is the default, and says so.
	const open = new FonderieApp(config).register(new AdminModule({ adminToken: TOKEN }));
	await open.boot();
	assert.equal(
		(await open.handle(at('anything.example.com', '/_admin/manifest', TOKEN))).status,
		200,
	);
	assert.equal(
		(
			(await (await open.handle(at('x.example.com', '/_admin/manifest', TOKEN))).json()) as {
				result: IAdminManifest;
			}
		).result.admin.host,
		null,
	);
});

// A module that cannot say its version leaves a row reading "not reported" on
// the operator's Modules page — honest and useless. The page answers "what is
// actually deployed here", and it answered it for exactly one module out of six
// until every brick reported. This is a static check because the alternative is
// constructing eleven modules with their real dependencies to read one field.
test('every brick module reports its version, so the Modules page can answer', async () => {
	const { readdirSync, readFileSync, existsSync } = await import('node:fs');
	const { join } = await import('node:path');
	const root = join(import.meta.dirname, '..', '..', '..');

	const missing: string[] = [];
	for (const pkg of readdirSync(root).sort()) {
		const file = join(root, pkg, 'src', 'module.ts');
		if (!existsSync(file)) continue;
		const src = readFileSync(file, 'utf8');
		// Only classes that actually implement the module contract.
		if (!/implements\s+IFonderieModule/.test(src)) continue;
		if (!/readonly version\b/.test(src)) missing.push(pkg);
	}

	assert.deepEqual(
		missing,
		[],
		`these modules do not report a version — add\n` +
			`  readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';\n` +
			`(tsup.base bakes FONDERIE_PKG_VERSION in at build time)`,
	);
});

// ---------------------------------------------------------------------------
// Applying pending migrations from the panel.
//
// Real directories on disk: the runner reads the filesystem, and a fake that
// returned file lists would test the fake rather than the ordering rule that
// makes this safe.
// ---------------------------------------------------------------------------

function migrationDirs(spec: Record<string, Record<string, string>>) {
	const root = mkdtempSync(join(tmpdir(), 'fonderie-mig-'));
	const sets: Array<readonly [string, string]> = [];
	for (const [module, files] of Object.entries(spec)) {
		const dir = join(root, module);
		mkdirSync(dir, { recursive: true });
		for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
		sets.push([module, dir]);
	}
	return { root, sets };
}

// Tracks fonderie_migrations for real, so pending() and the apply path see the
// same table the runner writes.
function migrationStore(applied: string[] = []) {
	const rows = new Set(applied);
	const ran: string[] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			if (sql.includes('INSERT INTO fonderie_admin_log')) return [];
			if (sql.includes('count(*)')) return [{ n: rows.size }] as unknown as T[];
			// Order matters: the in-lock recheck's SQL CONTAINS the list query's,
			// so matching the broad one first answers the recheck with every
			// applied row — the runner then treats each file as already done and
			// silently applies nothing after the first. Specific before general.
			if (sql.includes('WHERE name = $1'))
				return (rows.has(params[0] as string) ? [{ name: params[0] }] : []) as unknown as T[];
			if (sql.includes('SELECT name FROM fonderie_migrations'))
				return [...rows].sort().map((name) => ({ name })) as unknown as T[];
			if (sql.includes('INSERT INTO fonderie_migrations')) {
				rows.add(params[0] as string);
				return [];
			}
			if (sql.includes('pg_advisory_xact_lock')) return [];
			if (sql.includes('CREATE TABLE IF NOT EXISTS')) return [];
			// Whatever the migration file itself contained.
			ran.push(sql.trim());
			return [];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, rows, ran };
}

const migApp = async (sets: ReadonlyArray<readonly [string, string]>, store: IStoreAdapter) => {
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN, store, migrations: sets }));
	await app.boot();
	return app;
};

const migCall = (app: FonderieApp, method: string, path: string, token?: string, body?: unknown) =>
	app.handle(
		new Request(`http://localhost${path}`, {
			method,
			headers: {
				...(token ? { authorization: `Bearer ${token}` } : {}),
				'content-type': 'application/json',
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		}),
	);

test('migrations: reports pending per module with impact, and the first behind blocks the rest', async () => {
	const { sets } = migrationDirs({
		auth: { '001_a.sql': 'CREATE TABLE a();' },
		app: { '002_b.sql': 'ALTER TABLE a ADD COLUMN x int;' },
	});
	const { store } = migrationStore(['001_a.sql']); // auth already applied
	const app = await migApp(sets, store);

	const res = await migCall(app, 'GET', '/_admin/migrations', TOKEN);
	assert.equal(res.status, 200);
	const body = (await res.json()) as { result: IAdminMigrationsReport };
	assert.equal(body.result.everApplied, true);

	const [auth, appMod] = body.result.modules;
	assert.deepEqual(auth?.pending, []);
	assert.equal(auth?.blockedBy, null);
	assert.equal(appMod?.pending[0]?.file, '002_b.sql');
	assert.equal(appMod?.pending[0]?.impact, 'additive');
	// auth is clean, so nothing blocks app.
	assert.equal(appMod?.blockedBy, null);
	assert.equal(appMod?.appliable, true);
});

test('migrations: applies an all-additive module, and reports the re-read state', async () => {
	const { sets } = migrationDirs({
		auth: { '001_a.sql': 'CREATE TABLE a();', '002_b.sql': 'CREATE TABLE b();' },
	});
	const { store, rows, ran } = migrationStore();
	const app = await migApp(sets, store);

	const res = await migCall(app, 'POST', '/_admin/migrations/auth/apply', TOKEN, {
		expect: ['001_a.sql', '002_b.sql'],
	});
	assert.equal(res.status, 200);
	const body = (await res.json()) as { reason: string; result: IAdminMigrationModule };
	assert.equal(body.reason, 'MIGRATIONS_APPLIED');
	// The answer comes from reading the table back, not from assuming run() worked.
	assert.deepEqual(body.result.pending, []);
	assert.deepEqual([...rows].sort(), ['001_a.sql', '002_b.sql']);
	assert.ok(ran.some((s) => s.includes('CREATE TABLE a')));
});

test('migrations: refuses a module containing a destructive file, naming the statement', async () => {
	const { sets } = migrationDirs({
		app: { '001_ok.sql': 'CREATE TABLE a();', '002_drop.sql': 'DROP TABLE legacy_credits;' },
	});
	// everApplied: something is already in the table, so there IS data to lose.
	const { store, rows } = migrationStore(['000_seed.sql']);
	const app = await migApp(sets, store);

	const res = await migCall(app, 'POST', '/_admin/migrations/app/apply', TOKEN, {
		expect: ['001_ok.sql', '002_drop.sql'],
	});
	assert.equal(res.status, 422);
	const body = (await res.json()) as {
		reason: string;
		details: { files: IAdminPendingMigration[] };
	};
	assert.equal(body.reason, 'MIGRATION_DESTRUCTIVE');
	assert.equal(body.details.files[0]?.file, '002_drop.sql');
	assert.match(body.details.files[0]?.destructive[0] ?? '', /DROP TABLE legacy_credits/);
	// Nothing was applied — not even the additive file that sorts before it.
	assert.deepEqual([...rows], ['000_seed.sql']);
});

test('migrations: a virgin database has nothing to lose, so a DROP does not block it', async () => {
	const { sets } = migrationDirs({ app: { '001_drop.sql': 'DROP TABLE whatever;' } });
	const { store } = migrationStore(); // no history at all
	const app = await migApp(sets, store);

	const res = await migCall(app, 'POST', '/_admin/migrations/app/apply', TOKEN, {
		expect: ['001_drop.sql'],
	});
	assert.equal(res.status, 200);
	assert.equal(((await res.json()) as { reason: string }).reason, 'MIGRATIONS_APPLIED');
});

test('migrations: refuses out of order, naming the module to apply first', async () => {
	const { sets } = migrationDirs({
		auth: { '001_a.sql': 'CREATE TABLE a();' },
		app: { '002_b.sql': 'CREATE TABLE b();' },
	});
	const { store, rows } = migrationStore();
	const app = await migApp(sets, store);

	const res = await migCall(app, 'POST', '/_admin/migrations/app/apply', TOKEN, {
		expect: ['002_b.sql'],
	});
	assert.equal(res.status, 409);
	const body = (await res.json()) as { reason: string; details: { blockedBy: string } };
	assert.equal(body.reason, 'MIGRATIONS_OUT_OF_ORDER');
	assert.equal(body.details.blockedBy, 'auth');
	assert.equal(rows.size, 0);
});

test('migrations: refuses when the pending set changed since the operator looked', async () => {
	const { sets } = migrationDirs({
		app: { '001_a.sql': 'CREATE TABLE a();', '002_new.sql': 'CREATE TABLE b();' },
	});
	const { store, rows } = migrationStore(['000_seed.sql']);
	const app = await migApp(sets, store);

	// The operator was shown only 001 — 002 landed in between.
	const res = await migCall(app, 'POST', '/_admin/migrations/app/apply', TOKEN, {
		expect: ['001_a.sql'],
	});
	assert.equal(res.status, 409);
	const body = (await res.json()) as {
		reason: string;
		details: { expected: string[]; actual: string[] };
	};
	assert.equal(body.reason, 'MIGRATIONS_CHANGED');
	assert.deepEqual(body.details.actual, ['001_a.sql', '002_new.sql']);
	assert.deepEqual([...rows], ['000_seed.sql']);
});

test('migrations: unknown module is 404; no token is 401; a read token cannot apply', async () => {
	const { sets } = migrationDirs({ auth: { '001_a.sql': 'CREATE TABLE a();' } });
	const { store } = migrationStore();
	const app = await migApp(sets, store);

	assert.equal(
		(await migCall(app, 'POST', '/_admin/migrations/nope/apply', TOKEN, { expect: [] })).status,
		404,
	);
	assert.equal(
		(await migCall(app, 'POST', '/_admin/migrations/auth/apply', undefined, { expect: [] })).status,
		401,
	);
	// A malformed body never reaches the applier.
	assert.equal(
		(await migCall(app, 'POST', '/_admin/migrations/auth/apply', TOKEN, { expect: 'nope' })).status,
		422,
	);
});

test('migrations: routes do not exist when the app hands over no migration sets', async () => {
	const { store } = migrationStore();
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN, store }));
	await app.boot();
	assert.equal((await migCall(app, 'GET', '/_admin/migrations', TOKEN)).status, 404);
	assert.equal(
		(await migCall(app, 'POST', '/_admin/migrations/auth/apply', TOKEN, { expect: [] })).status,
		404,
	);
});

// ---------------------------------------------------------------------------
// The served UI decides which pages to offer by probing the manifest for a
// path. That probe MUST use a path the probed brick uniquely owns.
//
// It did not. The config page probed `/config` — which THIS module registered
// itself, as the declared-vs-held report. So on a deployment WITHOUT
// @fonderie/config the probe was true, the shell built a ConfigAdminClient,
// and listConfig() fetched /_admin/config successfully and got admin's report
// OBJECT where it expected an ARRAY of config entries. The page died on
// `entries.map(...)` with "a.map is not a function", while /_admin/secrets
// 404'd beside it. A 200 carrying the wrong shape is worse than a 404 —
// nothing reports it.
//
// The probe was changed to /secrets, and the NAME has now been fixed at the
// root: this module's report moved to /_admin/environment, which is what it
// always was — readiness problems and which declared env vars are set. Holding
// "config" also made @fonderie/config unmountable beside the console: both
// described GET /_admin/config and boot failed outright, in either order.
// ---------------------------------------------------------------------------

// The collision this rename ended, pinned so it cannot come back.
//
// @fonderie/config describes GET /_admin/config. While this module registered
// the same path for its declared-vs-held report, boot FAILED outright in either
// registration order — so the config brick could never be used alongside the
// admin console at all, and its "Config & secrets" page was unreachable by
// construction. The failure was loud but nobody hit it, because nobody could
// get far enough to try.
test('@fonderie/config mounts alongside the console, in either order', async () => {
	const { ConfigModule } = await import('@fonderie/config');
	const store = {
		query: async () => [],
		transaction: async (fn: (tx: unknown) => unknown) => fn({ query: async () => [] }),
	} as never;

	for (const reversed of [false, true]) {
		const app = new FonderieApp(config);
		const cfg = new ConfigModule(store, { adminToken: TOKEN });
		const mods = [cfg, new AdminModule({ adminToken: TOKEN })];
		for (const m of reversed ? [...mods].reverse() : mods) app.register(m as never);

		try {
			// The assertion IS that this does not throw. Before the rename it threw
			// "[fonderie] @fonderie/config cannot describe GET /_admin/config".
			await app.boot();

			const seen = app.routes().map((r) => `${r.method} ${r.path}`);
			assert.equal(
				seen.length - new Set(seen).size,
				0,
				`duplicate routes with order reversed=${reversed}`,
			);
			assert.ok(seen.includes('GET /_admin/environment'), 'the report is still served');
			assert.ok(seen.includes('GET /_admin/config'), 'the config brick is mounted under the prefix');
		} finally {
			// boot() starts a TTL refresh interval. Leaving it running keeps the
			// test process alive forever — which is precisely the failure that hung
			// CI for six release cycles from @fonderie/events. Stop what you start.
			cfg.manager.stop();
		}
	}
});

test('the environment report does not squat on any config path', async () => {
	const app = new FonderieApp(config);
	app.register(new AdminModule({ adminToken: TOKEN }));
	await app.boot();

	const paths = new Set(app.routes().map((r) => r.path));

	assert.ok(paths.has('/_admin/environment'), 'the declared-vs-held report lives here now');

	// Both of these belong to @fonderie/config. Claiming EITHER makes that brick
	// unmountable beside the console — the failure this rename exists to end —
	// and turns the served UI's probe into a false positive all over again.
	assert.equal(
		paths.has('/_admin/config'),
		false,
		'/_admin/config must stay exclusive to @fonderie/config',
	);
	assert.equal(
		paths.has('/_admin/secrets'),
		false,
		'/_admin/secrets must stay exclusive to @fonderie/config — the served UI probes it',
	);

	// And the shape that made the old collision silent: the report answers with
	// an OBJECT, never the array a config-entry list would return.
	const res = await get(app, '/_admin/environment', TOKEN);
	assert.equal(res.status, 200);
	const { result } = (await res.json()) as { result: unknown };
	assert.equal(Array.isArray(result), false, 'the environment report is an object, not a list');
	assert.ok(result && typeof result === 'object' && 'env' in result);
});
