import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IFonderieApp, IFonderieModule } from '@fonderie/core';

import { AdminModule } from '../module';
import type { IAdminManifest } from '../types';

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
			['GET', '/v1/_admin/manifest', '@fonderie/admin'],
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
