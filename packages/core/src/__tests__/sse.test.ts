import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp } from '../app';
import { defineConfig } from '../config';
import { formatSseEvent, isEventStream, sseResponse, type ISseStream } from '../sse';

const decoder = new TextDecoder();

/** Read a stream until `predicate(text so far)` holds, or fail after `ms`. */
async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, predicate: (s: string) => boolean, ms = 2000) {
	let text = '';
	const deadline = Date.now() + ms;
	while (!predicate(text)) {
		const left = deadline - Date.now();
		if (left <= 0) throw new Error(`timed out; got: ${JSON.stringify(text)}`);
		const chunk = await Promise.race([
			reader.read(),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out; got: ${JSON.stringify(text)}`)), left)),
		]);
		if (chunk.done) break;
		text += decoder.decode(chunk.value, { stream: true });
	}
	return text;
}

const until = async (cond: () => boolean, ms = 2000) => {
	const deadline = Date.now() + ms;
	while (!cond()) {
		if (Date.now() > deadline) throw new Error('condition not met in time');
		await new Promise((r) => setTimeout(r, 10));
	}
};

// ── framing ──────────────────────────────────────────────────────────────────

test('formatSseEvent: id, event, JSON data, one data: line per line', () => {
	assert.equal(formatSseEvent({ id: '7', event: 'x.changed', data: { a: 1 } }), 'id: 7\nevent: x.changed\ndata: {"a":1}\n\n');
	assert.equal(formatSseEvent({ data: 'line1\nline2' }), 'data: line1\ndata: line2\n\n');
	// A newline in id/event would inject a field — it is neutralised.
	assert.equal(formatSseEvent({ id: 'a\nevent: evil', data: 'x' }), 'id: a event: evil\ndata: x\n\n');
});

// ── the Response itself ──────────────────────────────────────────────────────

test('sseResponse: event-stream headers, retry hint first, then frames', async () => {
	let s!: ISseStream;
	const res = sseResponse(undefined, (stream) => {
		s = stream;
	}, { heartbeatMs: 0, retryMs: 1500 });
	assert.ok(isEventStream(res));
	assert.equal(res.headers.get('cache-control'), 'no-store, no-transform');
	const reader = res.body!.getReader();
	assert.match(await readUntil(reader, (t) => t.includes('retry:')), /^retry: 1500\n\n/);
	await until(() => s !== undefined);
	s.send({ event: 'hello', data: { n: 1 } });
	assert.match(await readUntil(reader, (t) => t.includes('hello')), /event: hello\ndata: \{"n":1\}/);
	s.close();
});

test('sseResponse: heartbeat comments keep the connection alive', async () => {
	const res = sseResponse(undefined, () => {}, { heartbeatMs: 20 });
	const reader = res.body!.getReader();
	assert.match(await readUntil(reader, (t) => t.includes(': ping')), /: ping\n\n/);
	await reader.cancel();
});

test('sseResponse: the abort signal (client gone) runs cleanup and ends the stream', async () => {
	const ac = new AbortController();
	let cleaned = 0;
	const res = sseResponse(ac.signal, () => () => { cleaned++; }, { heartbeatMs: 0 });
	const reader = res.body!.getReader();
	await readUntil(reader, (t) => t.includes('retry:'));
	await until(() => true);
	await new Promise((r) => setTimeout(r, 10)); // let onOpen's cleanup register
	ac.abort();
	await until(() => cleaned === 1);
	assert.equal((await reader.read()).done, true, 'stream ended');
});

test('sseResponse: a consumer cancel runs cleanup exactly once', async () => {
	let cleaned = 0;
	const res = sseResponse(undefined, () => () => { cleaned++; }, { heartbeatMs: 0 });
	const reader = res.body!.getReader();
	await readUntil(reader, (t) => t.includes('retry:'));
	await new Promise((r) => setTimeout(r, 10));
	await reader.cancel();
	await until(() => cleaned === 1);
	await new Promise((r) => setTimeout(r, 20));
	assert.equal(cleaned, 1);
});

test('sseResponse: maxLifetimeMs closes the stream so the client reconnects (re-auth)', async () => {
	let cleaned = 0;
	const res = sseResponse(undefined, () => () => { cleaned++; }, { heartbeatMs: 0, maxLifetimeMs: 30 });
	const reader = res.body!.getReader();
	let done = false;
	while (!done) done = (await reader.read()).done;
	assert.equal(cleaned, 1);
});

test('sseResponse: a handler that throws ends the stream with an error frame', async () => {
	const res = sseResponse(undefined, () => { throw new Error('boom'); }, { heartbeatMs: 0 });
	const text = await readUntil(res.body!.getReader(), (t) => t.includes('STREAM_FAILED'));
	assert.match(text, /event: error\ndata: \{"reason":"STREAM_FAILED"\}/);
});

// ── end to end through core's own listen() ───────────────────────────────────

async function serve(setup: (app: FonderieApp) => void) {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	setup(app);
	await app.boot();
	const server = app.listen(0, { quiet: true });
	await new Promise((r) => (server.listening ? r(undefined) : server.once('listening', r)));
	const { port } = server.address() as { port: number };
	return {
		url: `http://127.0.0.1:${port}`,
		// Bounded: a transport that wrongly buffers never finishes the response,
		// and close() would wait forever — fail the test, never hang the suite.
		close: () =>
			new Promise((r) => {
				server.closeAllConnections();
				server.close(() => r(undefined));
				setTimeout(r, 1000).unref();
			}),
	};
}

test('listen(): an SSE response streams — events arrive while the stream is still open', async () => {
	let stream!: ISseStream;
	const srv = await serve((app) =>
		app.addRoute('GET', '/stream', async (ctx) => sseResponse(ctx.request.signal, (s) => { stream = s; }, { heartbeatMs: 0 })),
	);
	const ac = new AbortController();
	try {
		// A transport that buffers never sends headers for an endless body, so
		// fetch would wait forever — the timeout turns that into a fast failure.
		const res = await fetch(`${srv.url}/stream`, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(2000)]) });
		assert.equal(res.status, 200);
		assert.ok(res.headers.get('content-type')?.startsWith('text/event-stream'));
		const reader = res.body!.getReader();
		await readUntil(reader, (t) => t.includes('retry:')); // before any end: it streams
		await until(() => stream !== undefined);
		stream.send({ event: 'config.changed', data: { environment: 'production' } });
		assert.match(await readUntil(reader, (t) => t.includes('config.changed')), /event: config\.changed/);
	} finally {
		ac.abort();
		await srv.close();
	}
});

test('listen(): a client disconnect aborts ctx.request.signal and runs the stream cleanup', async () => {
	let cleaned = 0;
	const srv = await serve((app) =>
		app.addRoute('GET', '/stream', async (ctx) => sseResponse(ctx.request.signal, () => () => { cleaned++; }, { heartbeatMs: 0 })),
	);
	try {
		const ac = new AbortController();
		const res = await fetch(`${srv.url}/stream`, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(2000)]) });
		await readUntil(res.body!.getReader(), (t) => t.includes('retry:'));
		ac.abort();
		await until(() => cleaned === 1);
	} finally {
		await srv.close();
	}
});

test('listen(): ordinary responses are still buffered with a Content-Length', async () => {
	const srv = await serve((app) => app.addRoute('GET', '/json', async () => Response.json({ ok: true })));
	try {
		const res = await fetch(`${srv.url}/json`);
		assert.equal(res.headers.get('content-length'), String(JSON.stringify({ ok: true }).length));
		assert.deepEqual(await res.json(), { ok: true });
	} finally {
		await srv.close();
	}
});
