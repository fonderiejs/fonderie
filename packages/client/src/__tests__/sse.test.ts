import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';

import { FonderieClient } from '../client';
import type { ISseClientEvent } from '../modules/sse';

// A tiny SSE server speaking @fonderie/sse's protocol: reset on connect, one
// frame per event. Records every stream request so tests can count connections.
async function sseServer(opts: { status?: number; configValues?: Record<string, unknown> } = {}) {
	const streams: Array<{ res: ServerResponse; topics: string; auth?: string | undefined; workspace?: string | undefined }> = [];
	let configLoads = 0;
	let status = opts.status ?? 200;
	const server = createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://x');
		if (url.pathname === '/config/public') {
			configLoads++;
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ reason: 'PUBLIC_CONFIG_FETCHED', explanation: '', result: { values: opts.configValues ?? { WITH_JOBS_SCREEN: true } } }));
			return;
		}
		if (url.pathname === '/auth/refresh') {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ reason: 'OK', explanation: '', result: { tokens: { access: 'fresh-token', refresh: 'r2' } } }));
			return;
		}
		if (url.pathname !== '/sse/stream') {
			res.writeHead(404).end();
			return;
		}
		const auth = req.headers['authorization'];
		if (status !== 200) {
			res.writeHead(status).end();
			return;
		}
		if (auth === 'Bearer expired') {
			res.writeHead(401).end();
			return;
		}
		res.writeHead(200, { 'content-type': 'text/event-stream' });
		res.write('retry: 1000\n\n');
		res.write('event: fonderie.stream.reset\ndata: {"reason":"CONNECTED"}\n\n');
		streams.push({ res, topics: url.searchParams.get('topics') ?? '', auth: auth as string | undefined, workspace: req.headers['x-workspace-id'] as string | undefined });
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const { port } = server.address() as { port: number };
	const open = () => streams.filter((s) => !s.res.writableEnded && !s.res.destroyed);
	return {
		url: `http://127.0.0.1:${port}`,
		streams,
		open,
		get configLoads() { return configLoads; },
		setStatus(s: number) { status = s; },
		send(type: string, data: Record<string, unknown>, id = 'e1') {
			for (const s of open()) s.res.write(`id: ${id}\nevent: ${type}\ndata: ${JSON.stringify({ type, data, at: '2026-09-29T00:00:00Z' })}\n\n`);
		},
		endAll() { for (const s of open()) s.res.end(); },
		close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }),
	};
}

const until = async (cond: () => boolean, ms = 3000) => {
	const deadline = Date.now() + ms;
	while (!cond()) {
		if (Date.now() > deadline) throw new Error('condition not met in time');
		await new Promise((r) => setTimeout(r, 10));
	}
};

test('subscribe: receives matching events, ignores the rest, and resets on connect', async () => {
	const srv = await sseServer();
	const client = new FonderieClient({ baseUrl: srv.url, accessToken: 't1', workspaceId: 'w1' });
	const got: ISseClientEvent[] = [];
	let resets = 0;
	const stop = client.sse.subscribe(['fonderie.customer.*'], (e) => got.push(e), { onReset: () => resets++ });
	try {
		await until(() => resets === 1 && client.sse.status === 'open');
		assert.equal(srv.streams[0]!.auth, 'Bearer t1');
		assert.equal(srv.streams[0]!.workspace, 'w1');
		srv.send('fonderie.customer.created', { customerId: 'c1' });
		srv.send('fonderie.billing.invoice.paid', { invoiceId: 'i1' });
		await until(() => got.length >= 1);
		await new Promise((r) => setTimeout(r, 50));
		assert.deepEqual(got.map((e) => [e.type, e.data]), [['fonderie.customer.created', { customerId: 'c1' }]]);
	} finally {
		stop();
		await srv.close();
	}
});

test('subscriptions share ONE connection on the union of their topics', async () => {
	const srv = await sseServer();
	const client = new FonderieClient({ baseUrl: srv.url, accessToken: 't1' });
	const a: string[] = [];
	const b: string[] = [];
	const stopA = client.sse.subscribe(['fonderie.customer.*'], (e) => a.push(e.type));
	const stopB = client.sse.subscribe(['fonderie.config.changed'], (e) => b.push(e.type));
	try {
		await until(() => srv.open().length === 1 && srv.open()[0]!.topics === 'fonderie.config.changed,fonderie.customer.*');
		srv.send('fonderie.config.changed', {});
		srv.send('fonderie.customer.created', { customerId: 'c1' });
		await until(() => a.length === 1 && b.length === 1);
		assert.deepEqual([a, b], [['fonderie.customer.created'], ['fonderie.config.changed']]);
		stopA();
		stopB();
		await until(() => srv.open().length === 0); // last unsubscribe closes the stream
	} finally {
		await srv.close();
	}
});

test('a server-closed stream (lifetime) reconnects and resets again', async () => {
	const srv = await sseServer();
	const client = new FonderieClient({ baseUrl: srv.url, accessToken: 't1' });
	let resets = 0;
	const stop = client.sse.subscribe(['*'], () => {}, { onReset: () => resets++ });
	try {
		await until(() => resets === 1);
		srv.endAll();
		await until(() => resets === 2, 5000);
		assert.equal(srv.streams.length, 2);
	} finally {
		stop();
		await srv.close();
	}
});

test('an expired token is refreshed once, then the stream opens with the new one', async () => {
	const srv = await sseServer();
	const client = new FonderieClient({
		baseUrl: srv.url,
		accessToken: 'expired',
		auth: { getRefreshToken: () => 'r1', onTokensChanged: () => {} },
	});
	let resets = 0;
	const stop = client.sse.subscribe(['*'], () => {}, { onReset: () => resets++ });
	try {
		await until(() => resets === 1);
		assert.equal(srv.streams[0]!.auth, 'Bearer fresh-token');
	} finally {
		stop();
		await srv.close();
	}
});

test('a server without @fonderie/sse (404): status unavailable, no reconnect storm', async () => {
	const srv = await sseServer({ status: 404 });
	const client = new FonderieClient({ baseUrl: srv.url });
	const stop = client.sse.subscribe(['*'], () => {});
	try {
		await until(() => client.sse.status === 'unavailable');
		await new Promise((r) => setTimeout(r, 300));
		assert.equal(client.sse.status, 'unavailable');
	} finally {
		stop();
		await srv.close();
	}
});

test("a fetch that cannot stream (React Native's default) → unavailable, callers keep polling", async () => {
	const client = new FonderieClient({
		baseUrl: 'http://unused',
		sse: { fetch: async () => ({ ok: true, status: 200, body: {} as never }) },
	});
	const stop = client.sse.subscribe(['*'], () => {});
	await until(() => client.sse.status === 'unavailable');
	stop();
});

test('pause() closes the stream and stops reconnecting; resume() reconnects with a reset', async () => {
	const srv = await sseServer();
	const client = new FonderieClient({ baseUrl: srv.url });
	let resets = 0;
	const stop = client.sse.subscribe(['*'], () => {}, { onReset: () => resets++ });
	try {
		await until(() => resets === 1);
		client.sse.pause();
		await until(() => srv.open().length === 0);
		await new Promise((r) => setTimeout(r, 200));
		assert.equal(srv.streams.length, 1, 'no reconnect while paused');
		client.sse.resume();
		await until(() => resets === 2);
	} finally {
		stop();
		await srv.close();
	}
});

// ── config: live by default, device storage, missing-key warning ────────────

test('config.retain(): loads, then re-reads on connect and on every change — one stream for many readers', async () => {
	const srv = await sseServer();
	const client = new FonderieClient({ baseUrl: srv.url });
	const release1 = client.config.retain();
	const release2 = client.config.retain();
	try {
		await until(() => srv.configLoads >= 1 && srv.open().length === 1);
		const before = srv.configLoads;
		srv.send('fonderie.config.changed', { environment: 'production' });
		await until(() => srv.configLoads === before + 1);
		assert.equal(srv.open().length, 1, 'two readers, one stream');
		release1();
		await new Promise((r) => setTimeout(r, 50));
		assert.equal(srv.open().length, 1, 'still read');
		release2();
		await until(() => srv.open().length === 0);
	} finally {
		await srv.close();
	}
});

test('config never polls: with the stream idle, no further requests', async () => {
	const srv = await sseServer();
	const client = new FonderieClient({ baseUrl: srv.url });
	const release = client.config.retain();
	try {
		await until(() => srv.open().length === 1 && srv.configLoads >= 1);
		await new Promise((r) => setTimeout(r, 50));
		const settled = srv.configLoads;
		await new Promise((r) => setTimeout(r, 400));
		assert.equal(srv.configLoads, settled);
	} finally {
		release();
		await srv.close();
	}
});

test('config storage: a cold start restores the saved answer before any network; a fresh answer replaces and is saved', async () => {
	const saved = new Map<string, string>([['fonderie.config.public', JSON.stringify({ WITH_JOBS_SCREEN: false })]]);
	const storage = { getItem: async (k: string) => saved.get(k) ?? null, setItem: async (k: string, v: string) => void saved.set(k, v) };
	const srv = await sseServer({ configValues: { WITH_JOBS_SCREEN: true } });
	const client = new FonderieClient({ baseUrl: srv.url, config: { storage } });
	try {
		await client.config.ready;
		assert.equal(client.config.get('WITH_JOBS_SCREEN', true), false, 'saved value decides before the network');
		assert.equal(srv.configLoads, 0);
		await client.config.load();
		assert.equal(client.config.get('WITH_JOBS_SCREEN', false), true);
		await until(() => saved.get('fonderie.config.public') === JSON.stringify({ WITH_JOBS_SCREEN: true }));
	} finally {
		await srv.close();
	}
});

test('config storage: unreadable storage never blocks — ready still settles, fallbacks apply', async () => {
	const warnings: string[] = [];
	const client = new FonderieClient({
		baseUrl: 'http://unused',
		config: { storage: { getItem: async () => { throw new Error('disk gone'); }, setItem: () => {} } },
		log: { warn: (m) => warnings.push(m) },
	});
	await client.config.ready;
	assert.equal(client.config.get('WITH_JOBS_SCREEN', true), true);
	assert.match(warnings.join('\n'), /could not restore saved remote config: disk gone/);
});

test('config.get(): a key the server does not expose warns once, only after the server answered', async () => {
	const srv = await sseServer({ configValues: { WITH_JOBS_SCREEN: true } });
	const warnings: string[] = [];
	const client = new FonderieClient({ baseUrl: srv.url, log: { warn: (m) => warnings.push(m) } });
	try {
		assert.equal(client.config.get('WITH_JOBZ_SCREEN', false), false);
		assert.equal(warnings.length, 0, 'before any answer the key may simply not be loaded yet');
		await client.config.load();
		client.config.get('WITH_JOBZ_SCREEN', false);
		client.config.get('WITH_JOBZ_SCREEN', false);
		client.config.get('WITH_JOBS_SCREEN', false);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0]!, /"WITH_JOBZ_SCREEN" is not a public key on the server/);
	} finally {
		await srv.close();
	}
});
