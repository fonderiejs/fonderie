import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieApp } from '../app';
import { defineConfig } from '../config';
import type { IFonderieApp, IFonderieModule, IRouteEntry } from '../types';

const config = defineConfig({ db: { url: 'postgres://localhost/test' } });
const ok = async () => Response.json({ ok: true });

function module(
	name: string,
	install: (app: IFonderieApp) => void,
	deps?: string[],
): IFonderieModule {
	return deps ? { name, deps, install } : { name, install };
}

function strip(entries: IRouteEntry[]): Array<[string, string, string | undefined]> {
	return entries.map((e) => [e.method, e.path, e.module]);
}

// ── routes(): the table, attributed ──────────────────────────────────

test('routes(): lists app and module routes with attribution, basePath applied, probes owned by core', async () => {
	const app = new FonderieApp(
		defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1', metrics: true }),
	);
	app.addRoute('GET', '/app-level', ok);
	app.register(module('@fonderie/thing', (a) => a.addRoute('post', '/things', ok)));
	await app.boot();

	assert.deepEqual(strip(app.routes()), [
		['GET', '/v1/app-level', undefined],
		['POST', '/v1/things', '@fonderie/thing'],
		['GET', '/healthz', '@fonderie/core'],
		['GET', '/metrics', '@fonderie/core'],
		['GET', '/readyz', '@fonderie/core'],
	]);
	for (const entry of app.routes()) assert.equal('handler' in entry, false);
});

// ── core's probes are reserved ───────────────────────────────────────

test('a module mounting /healthz fails at boot, naming the module and core', async () => {
	const app = new FonderieApp(config);
	app.register(module('@acme/squatter', (a) => a.addRoute('GET', '/healthz', ok)));
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/@acme\/squatter cannot mount GET \/healthz.*reserved by @fonderie\/core/.test(err.message),
	);
});

test('/metrics is reserved only when metrics are on; /healthz only when health checks are on', async () => {
	const a = new FonderieApp(config);
	a.register(module('@acme/own-metrics', (x) => x.addRoute('GET', '/metrics', ok)));
	await a.boot();
	assert.equal((await a.handle(new Request('http://localhost/metrics'))).status, 200);

	const b = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, healthChecks: false }));
	b.register(
		module('@acme/own-health', (x) =>
			x.addRoute('GET', '/healthz', async () => Response.json({ mine: true })),
		),
	);
	await b.boot();
	assert.deepEqual(await (await b.handle(new Request('http://localhost/healthz'))).json(), {
		mine: true,
	});
});

test('probes are unprefixed, so a module route at basePath + /healthz is not a collision', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1' }));
	app.register(
		module('@acme/thing', (a) =>
			a.addRoute('GET', '/healthz', async () => Response.json({ v1: true })),
		),
	);
	await app.boot();
	assert.deepEqual(await (await app.handle(new Request('http://localhost/v1/healthz'))).json(), {
		v1: true,
	});
	assert.deepEqual(await (await app.handle(new Request('http://localhost/healthz'))).json(), {
		status: 'ok',
	});
});

// ── module reservations ──────────────────────────────────────────────

test('the reserving module may mount under its prefix; a later module may not', async () => {
	const app = new FonderieApp(config);
	app.register(
		module('@fonderie/admin', (a) => {
			a.reserve('/_admin');
			a.addRoute('GET', '/_admin', ok);
			a.addRoute('GET', '/_admin/manifest', ok);
		}),
	);
	app.register(
		module('@acme/later', (a) => a.addRoute('GET', '/_admin/mine', ok), ['@fonderie/admin']),
	);
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/@acme\/later cannot mount GET \/_admin\/mine.*reserved by @fonderie\/admin/.test(
				err.message,
			),
	);
});

test('order does not matter: reserving over a route another module already mounted fails too', async () => {
	const app = new FonderieApp(config);
	app.register(module('@acme/earlier', (a) => a.addRoute('GET', '/_admin/mine', ok)));
	app.register(module('@fonderie/admin', (a) => a.reserve('/_admin'), ['@acme/earlier']));
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/@fonderie\/admin cannot reserve \/_admin.*@acme\/earlier already mounted GET \/_admin\/mine/.test(
				err.message,
			),
	);
});

test('a prefix owns itself and its subtree, not its lexical neighbours', async () => {
	const app = new FonderieApp(config);
	app.register(module('@fonderie/admin', (a) => a.reserve('/_admin')));
	app.register(
		module('@acme/neighbour', (a) => a.addRoute('GET', '/_adminx', ok), ['@fonderie/admin']),
	);
	await app.boot();
	assert.equal((await app.handle(new Request('http://localhost/_adminx'))).status, 200);
});

test('reserve() and addRoute() share the basePath coordinate system', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1' }));
	app.register(
		module('@fonderie/admin', (a) => {
			a.reserve('/_admin');
			a.addRoute('GET', '/_admin/manifest', ok);
		}),
	);
	app.register(
		module('@acme/later', (a) => a.addRoute('GET', '/_admin/mine', ok), ['@fonderie/admin']),
	);
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/cannot mount GET \/v1\/_admin\/mine.*prefix \/v1\/_admin is reserved/.test(err.message),
	);
});

test('re-reserving a prefix is idempotent for its owner and an error for anyone else', async () => {
	const app = new FonderieApp(config);
	app.register(
		module('@fonderie/admin', (a) => {
			a.reserve('/_admin');
			a.reserve('/_admin/');
		}),
	);
	app.register(module('@acme/rival', (a) => a.reserve('/_admin'), ['@fonderie/admin']));
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/@acme\/rival cannot reserve \/_admin: already reserved by @fonderie\/admin/.test(
				err.message,
			),
	);
});

// ── the application itself ───────────────────────────────────────────

test('the app can reserve a prefix for its own routes and keep modules out of it', async () => {
	const app = new FonderieApp(config);
	app.reserve('/internal');
	app.addRoute('POST', '/internal/cron', ok);
	app.register(module('@acme/thing', (a) => a.addRoute('GET', '/internal/peek', ok)));
	await assert.rejects(
		() => app.boot(),
		(err: Error) =>
			/@acme\/thing cannot mount GET \/internal\/peek.*reserved by the application/.test(
				err.message,
			),
	);
});

test('reserve() rejects a relative or empty prefix', () => {
	const app = new FonderieApp(config);
	assert.throws(() => app.reserve('admin'), /absolute path/);
	assert.throws(() => app.reserve(''), /absolute path/);
	const withBase = new FonderieApp(defineConfig({ db: { url: 'postgres://x' }, basePath: '/v1' }));
	// '' would resolve to basePath itself
	assert.throws(() => withBase.reserve(''), /absolute path/);
});
