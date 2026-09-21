import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IAdminCheck, IAdminRoute, IFonderieApp, IFonderieModule } from '@fonderie/core';

import { AdminModule } from '../module';
import type { IAdminAttention, IAdminDoctorReport, IAdminManifest } from '../types';

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
