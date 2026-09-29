import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FonderieApp, defineConfig, type IEventCatalogEntry, type IFonderieModule, type Middleware } from '@fonderie/core';

import { SseModule } from '../module';
import type { ISseBus } from '../types';

// ── fixtures ─────────────────────────────────────────────────────────────────

/** A bus with the shape SseModule accepts; emit() plays the events brick. */
function fakeBus() {
	const handlers = new Map<string, Array<(p: unknown, m: { id: string; emittedAt: string }) => unknown>>();
	let n = 0;
	const bus: ISseBus & { emit(type: string, payload: unknown): Promise<void> } = {
		on(type, handler) {
			handlers.set(type, [...(handlers.get(type) ?? []), handler as never]);
		},
		async emit(type, payload) {
			for (const h of handlers.get(type) ?? []) await h(payload, { id: `evt-${++n}`, emittedAt: new Date().toISOString() });
		},
	};
	return bus;
}

const CATALOG: IEventCatalogEntry[] = [
	{ type: 'test.config.changed', description: 'Public config changed', audience: 'public', project: () => ({}) },
	{
		type: 'fonderie.customer.created',
		description: 'A customer was added',
		audience: 'workspace',
		scope: (p) => ({ workspaceId: (p as { workspaceId: string }).workspaceId }),
		project: (p) => ({ customerId: (p as { customerId: string }).customerId }),
	},
	{
		type: 'test.user.notice',
		description: 'Something about you',
		audience: 'user',
		scope: (p) => ({ userId: (p as { userId: string }).userId }),
	},
	{
		type: 'test.admin.only',
		description: 'For admins (app rule)',
		audience: (ctx) => ctx.user?.id === 'admin-1',
	},
];
const catalogModule: IFonderieModule = { name: '@test/bricks', install() {}, describeEvents: () => CATALOG };

/** Stands in for the app's auth chain (session + withWorkspace): sets ctx.user / ctx.workspace. */
const testAuth: Middleware = async (ctx, next) => {
	const user = ctx.request.headers.get('x-test-user');
	const ws = ctx.request.headers.get('x-test-workspace');
	if (user) Object.assign(ctx, { user: { id: user, email: `${user}@acme.example`, phone: null, suspended: false, mfaEnabled: false } });
	if (ws) Object.assign(ctx, { workspace: { id: ws, name: ws } });
	return next();
};

async function start(extra: Partial<ConstructorParameters<typeof SseModule>[0]> = {}) {
	const bus = fakeBus();
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	app.register(catalogModule);
	const sse = new SseModule({ bus, middlewares: [testAuth], heartbeatMs: 0, ...extra });
	app.register(sse);
	await app.boot();
	const server = app.listen(0, { quiet: true });
	await new Promise((r) => (server.listening ? r(undefined) : server.once('listening', r)));
	const { port } = server.address() as { port: number };
	return {
		bus,
		sse,
		url: `http://127.0.0.1:${port}`,
		close: async () => {
			await sse.stop();
			await new Promise((r) => {
				server.closeAllConnections();
				server.close(() => r(undefined));
				setTimeout(r, 1000).unref();
			});
		},
	};
}

/** Open a stream and collect parsed SSE events. */
async function connect(url: string, headers: Record<string, string> = {}) {
	const ac = new AbortController();
	const res = await fetch(url, { headers, signal: AbortSignal.any([ac.signal, AbortSignal.timeout(5000)]) });
	const events: Array<{ event: string; data: unknown }> = [];
	if (res.ok && res.body) {
		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buf = '';
		void (async () => {
			try {
				for (;;) {
					const { value, done } = await reader.read();
					if (done) return;
					buf += decoder.decode(value, { stream: true });
					for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
						const frame = buf.slice(0, i);
						buf = buf.slice(i + 2);
						const event = /^event: (.*)$/m.exec(frame)?.[1];
						const data = frame.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
						if (event) events.push({ event, data: data ? JSON.parse(data) : null });
					}
				}
			} catch {
				// aborted
			}
		})();
	}
	const types = () => events.map((e) => e.event).filter((t) => t !== 'fonderie.stream.reset');
	return { res, events, types, close: () => ac.abort() };
}
const settle = () => new Promise((r) => setTimeout(r, 100));
const until = async (cond: () => boolean, ms = 2000) => {
	const deadline = Date.now() + ms;
	while (!cond()) {
		if (Date.now() > deadline) throw new Error('condition not met in time');
		await new Promise((r) => setTimeout(r, 10));
	}
};

// ── delivery ────────────────────────────────────────────────────────────────

test('every connect starts with fonderie.stream.reset (v1: refetch, no replay)', async () => {
	const srv = await start();
	const c = await connect(`${srv.url}/sse/stream`);
	try {
		await until(() => c.events.length > 0);
		assert.equal(c.events[0]!.event, 'fonderie.stream.reset');
	} finally {
		c.close();
		await srv.close();
	}
});

test('anonymous: receives public events only', async () => {
	const srv = await start();
	const c = await connect(`${srv.url}/sse/stream`);
	try {
		await until(() => c.events.length > 0);
		await srv.bus.emit('test.config.changed', { environment: 'production' });
		await srv.bus.emit('fonderie.customer.created', { customerId: 'c1', workspaceId: 'w1' });
		await settle();
		assert.deepEqual(c.types(), ['test.config.changed']);
	} finally {
		c.close();
		await srv.close();
	}
});

test("workspace audience: a member gets their workspace's events, never another's", async () => {
	const srv = await start();
	const w1 = await connect(`${srv.url}/sse/stream`, { 'x-test-user': 'u1', 'x-test-workspace': 'w1' });
	const w2 = await connect(`${srv.url}/sse/stream`, { 'x-test-user': 'u2', 'x-test-workspace': 'w2' });
	try {
		await until(() => w1.events.length > 0 && w2.events.length > 0);
		await srv.bus.emit('fonderie.customer.created', { customerId: 'c1', workspaceId: 'w1', email: 'private@acme.example' });
		await settle();
		assert.deepEqual(w1.types(), ['fonderie.customer.created']);
		assert.deepEqual(w2.types(), [], 'w2 never sees w1');
		const delivered = w1.events.find((e) => e.event === 'fonderie.customer.created')!.data as { data: Record<string, unknown> };
		assert.deepEqual(delivered.data, { customerId: 'c1' }, 'only the projection — no email on the wire');
	} finally {
		w1.close();
		w2.close();
		await srv.close();
	}
});

test('default deny: an event with no catalog entry never reaches any stream', async () => {
	const srv = await start();
	const c = await connect(`${srv.url}/sse/stream?topics=*`, { 'x-test-user': 'u1', 'x-test-workspace': 'w1' });
	try {
		await until(() => c.events.length > 0);
		await srv.bus.emit('fonderie.notification.send', { data: { pin: '123456' }, recipient: { email: 'u1@acme.example' } });
		await settle();
		assert.deepEqual(c.types(), []);
	} finally {
		c.close();
		await srv.close();
	}
});

test('user and custom audiences: only the user it is about / whom the app rule allows', async () => {
	const srv = await start();
	const me = await connect(`${srv.url}/sse/stream`, { 'x-test-user': 'u1' });
	const other = await connect(`${srv.url}/sse/stream`, { 'x-test-user': 'u2' });
	const admin = await connect(`${srv.url}/sse/stream`, { 'x-test-user': 'admin-1' });
	try {
		await until(() => me.events.length > 0 && other.events.length > 0 && admin.events.length > 0);
		await srv.bus.emit('test.user.notice', { userId: 'u1' });
		await srv.bus.emit('test.admin.only', {});
		await settle();
		assert.deepEqual(me.types(), ['test.user.notice']);
		assert.deepEqual(other.types(), []);
		assert.deepEqual(admin.types(), ['test.admin.only']);
	} finally {
		for (const c of [me, other, admin]) c.close();
		await srv.close();
	}
});

test('topic filters: a connection only gets what it subscribed to', async () => {
	const srv = await start();
	const c = await connect(`${srv.url}/sse/stream?topics=fonderie.customer.*`, { 'x-test-user': 'u1', 'x-test-workspace': 'w1' });
	try {
		await until(() => c.events.length > 0);
		await srv.bus.emit('test.config.changed', {});
		await srv.bus.emit('fonderie.customer.created', { customerId: 'c1', workspaceId: 'w1' });
		await settle();
		assert.deepEqual(c.types(), ['fonderie.customer.created']);
	} finally {
		c.close();
		await srv.close();
	}
});

// ── the request side ─────────────────────────────────────────────────────────

test('topic validation: malformed 400, unknown 400, signed-in-only topic anonymously 401', async () => {
	const srv = await start();
	try {
		const bad = await fetch(`${srv.url}/sse/stream?topics=${encodeURIComponent('fonderie.(a|b)')}`);
		assert.equal(bad.status, 400);
		const unknown = await fetch(`${srv.url}/sse/stream?topics=no.such.event`);
		assert.equal(unknown.status, 400);
		const needsAuth = await fetch(`${srv.url}/sse/stream?topics=fonderie.customer.created`);
		assert.equal(needsAuth.status, 401);
	} finally {
		await srv.close();
	}
});

test('GET /sse/topics: anonymous sees public topics; signed in sees the rest', async () => {
	const srv = await start();
	try {
		const anon = (await (await fetch(`${srv.url}/sse/topics`)).json()) as { result: { topics: Array<{ type: string }> } };
		assert.deepEqual(anon.result.topics.map((t) => t.type), ['test.config.changed']);
		const signed = (await (await fetch(`${srv.url}/sse/topics`, { headers: { 'x-test-user': 'u1' } })).json()) as { result: { topics: Array<{ type: string; audience: string }> } };
		assert.equal(signed.result.topics.length, CATALOG.length);
		assert.equal(signed.result.topics.find((t) => t.type === 'test.admin.only')!.audience, 'custom');
	} finally {
		await srv.close();
	}
});

test('per-user stream limit, and a closed stream frees its slot', async () => {
	const srv = await start({ maxConnectionsPerUser: 1 });
	try {
		const first = await connect(`${srv.url}/sse/stream`, { 'x-test-user': 'u1' });
		await until(() => first.events.length > 0);
		const second = await fetch(`${srv.url}/sse/stream`, { headers: { 'x-test-user': 'u1' } });
		assert.equal(second.status, 429);
		first.close();
		let third = await fetch(`${srv.url}/sse/stream`, { headers: { 'x-test-user': 'u1' }, signal: AbortSignal.timeout(3000) });
		for (let i = 0; third.status === 429 && i < 20; i++) {
			await new Promise((r) => setTimeout(r, 50));
			third = await fetch(`${srv.url}/sse/stream`, { headers: { 'x-test-user': 'u1' }, signal: AbortSignal.timeout(3000) });
		}
		assert.equal(third.status, 200, 'disconnect removed the connection');
		await third.body?.cancel();
	} finally {
		await srv.close();
	}
});

test('maxLifetimeMs ends the stream so the client reconnects through auth again', async () => {
	const srv = await start({ maxLifetimeMs: 150 });
	try {
		const res = await fetch(`${srv.url}/sse/stream`, { signal: AbortSignal.timeout(3000) });
		const text = await res.text(); // resolves only because the server ended the stream
		assert.match(text, /fonderie\.stream\.reset/);
	} finally {
		await srv.close();
	}
});

// ── dependency budget ────────────────────────────────────────────────────────

test('dependency budget: src imports no @fonderie/* package but core', () => {
	const dir = fileURLToPath(new URL('..', import.meta.url));
	const offenders: string[] = [];
	for (const f of readdirSync(dir)) {
		if (!/\.ts$/.test(f)) continue;
		// Real import/export statements only — prose in comments may name packages.
		for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/^\s*(?:import|export)\b[^;]*?from\s+'(@fonderie\/[^'/]+)/gm)) {
			if (m[1] !== '@fonderie/core') offenders.push(`${f}: ${m[1]}`);
		}
	}
	assert.deepEqual(offenders, []);
});
