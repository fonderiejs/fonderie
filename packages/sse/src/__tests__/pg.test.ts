import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

import { FonderieApp, defineConfig, type IFonderieModule } from '@fonderie/core';

import { SseModule } from '../module';
import { PgBroadcaster } from '../pg';
import type { ISseMessage } from '../types';

// Real Postgres only (CI sets SSE_PG_URL). LISTEN needs a session connection.
const URL = process.env['SSE_PG_URL'];
const skip = URL ? false : 'set SSE_PG_URL to run';

const until = async (cond: () => boolean, ms = 3000) => {
	const deadline = Date.now() + ms;
	while (!cond()) {
		if (Date.now() > deadline) throw new Error('condition not met in time');
		await new Promise((r) => setTimeout(r, 20));
	}
};

test('PgBroadcaster: a message published on one instance reaches another', { skip }, async () => {
	const a = new PgBroadcaster({ connectionString: URL!, channel: 'fonderie_sse_test' });
	const b = new PgBroadcaster({ connectionString: URL!, channel: 'fonderie_sse_test' });
	await a.start();
	await b.start();
	try {
		const got: ISseMessage[] = [];
		b.subscribe((m) => got.push(m));
		const msg: ISseMessage = { id: 'e1', type: 'fonderie.customer.created', scope: { workspaceId: 'w1' }, data: { customerId: 'c1' }, at: new Date().toISOString() };
		await a.publish(msg);
		await until(() => got.length === 1);
		assert.deepEqual(got[0], msg);
	} finally {
		await a.stop();
		await b.stop();
	}
});

test("SseModule + PgBroadcaster: a brick's own NOTIFY (config changed) reaches a live stream", { skip }, async () => {
	// The config brick's catalog entry, as @fonderie/config declares it.
	const configLike: IFonderieModule = {
		name: '@test/config',
		install() {},
		describeEvents: () => [
			{
				type: 'fonderie.config.changed',
				description: 'Remote config changed',
				audience: 'public',
				source: { notify: 'fonderie_config_changed' },
				project: (env) => ({ environment: env }),
			},
		],
	};
	const broadcaster = new PgBroadcaster({ connectionString: URL!, channel: 'fonderie_sse_test2' });
	const app = new FonderieApp(defineConfig({ db: { url: URL! } }));
	app.register(configLike);
	const sse = new SseModule({ broadcaster, heartbeatMs: 0 });
	app.register(sse);
	await app.boot();
	const server = app.listen(0, { quiet: true });
	await new Promise((r) => (server.listening ? r(undefined) : server.once('listening', r)));
	const { port } = server.address() as { port: number };
	const ac = new AbortController();
	const writer = new pg.Client({ connectionString: URL! });
	await writer.connect();
	try {
		const res = await fetch(`http://127.0.0.1:${port}/sse/stream?topics=fonderie.config.changed`, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(5000)]) });
		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let text = '';
		while (!text.includes('fonderie.stream.reset')) text += decoder.decode((await reader.read()).value, { stream: true });
		// Exactly what setConfigEntry/deleteConfigEntry send inside their transaction:
		await writer.query("SELECT pg_notify('fonderie_config_changed', 'production')");
		while (!text.includes('event: fonderie.config.changed')) text += decoder.decode((await reader.read()).value, { stream: true });
		assert.match(text, /data: \{"type":"fonderie\.config\.changed","data":\{"environment":"production"\}/);
	} finally {
		ac.abort();
		await writer.end();
		await sse.stop();
		await new Promise((r) => {
			server.closeAllConnections();
			server.close(() => r(undefined));
			setTimeout(r, 1000).unref();
		});
	}
});

test('PgBroadcaster({ listen: false }): a serverless producer publishes, a listening host receives', { skip }, async () => {
	const producer = new PgBroadcaster({ connectionString: URL!, channel: 'fonderie_sse_test3', listen: false });
	const host = new PgBroadcaster({ connectionString: URL!, channel: 'fonderie_sse_test3' });
	await producer.start();
	await host.start();
	try {
		const got: ISseMessage[] = [];
		host.subscribe((m) => got.push(m));
		await producer.publish({ id: 'e2', type: 'fonderie.customer.created', scope: { workspaceId: 'w1' }, data: { customerId: 'c2' }, at: new Date().toISOString() });
		await until(() => got.length === 1);
		assert.equal(got[0]!.data['customerId'], 'c2');
		await assert.rejects(() => producer.listen('anything', () => {}), /publish-only/);
	} finally {
		await producer.stop();
		await host.stop();
	}
});
