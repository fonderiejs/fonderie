import { test } from 'node:test';
import assert from 'node:assert/strict';
import Koa from 'koa';

import { FonderieApp, defineConfig, sseResponse, type ISseStream } from '@fonderie/core';

import { mount } from '../index';

// A fonderie route that returns sseResponse(), served through mount() on a
// real Koa server. Before, webResponseToKoa awaited arrayBuffer() —
// an endless body never sent a byte — and the Web Request had no signal.

const decoder = new TextDecoder();
async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, want: string, ms = 2000) {
	let text = '';
	const deadline = Date.now() + ms;
	while (!text.includes(want)) {
		const left = deadline - Date.now();
		if (left <= 0) throw new Error(`timed out waiting for ${want}; got ${JSON.stringify(text)}`);
		const chunk = await Promise.race([
			reader.read(),
			new Promise<never>((_, r) => setTimeout(() => r(new Error(`timed out waiting for ${want}`)), left)),
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

async function start() {
	const state: { stream?: ISseStream; cleaned: number } = { cleaned: 0 };
	const fonderie = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	fonderie.addRoute('GET', '/stream', async (ctx) =>
		sseResponse(ctx.request.signal, (s) => {
			state.stream = s;
			return () => { state.cleaned++; };
		}, { heartbeatMs: 0 }),
	);
	fonderie.addRoute('GET', '/json', async () => Response.json({ ok: true }));
	await fonderie.boot();
	const app = mount(new Koa(), fonderie);
	const server = await new Promise<import('node:http').Server>((resolve) => {
		const s = app.listen(0, () => resolve(s));
	});
	const { port } = server.address() as { port: number };
	return {
		state,
		url: `http://127.0.0.1:${port}`,
		close: () =>
			new Promise((r) => {
				server.closeAllConnections();
				server.close(() => r(undefined));
				setTimeout(r, 1000).unref();
			}),
	};
}
// A buffering transport never sends headers for an endless body — time out fast.
const open = (url: string, ac: AbortController) => fetch(url, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(2000)]) });

test('koa: an SSE route streams through mount() — events arrive while it stays open', async () => {
	const srv = await start();
	const ac = new AbortController();
	try {
		const res = await open(`${srv.url}/stream`, ac);
		assert.ok(res.headers.get('content-type')?.startsWith('text/event-stream'));
		const reader = res.body!.getReader();
		await readUntil(reader, 'retry:');
		await until(() => srv.state.stream !== undefined);
		srv.state.stream!.send({ event: 'config.changed', data: { environment: 'production' } });
		assert.match(await readUntil(reader, 'config.changed'), /event: config\.changed/);
	} finally {
		ac.abort();
		await srv.close();
	}
});

test('koa: a client disconnect reaches the handler and runs the stream cleanup', async () => {
	const srv = await start();
	try {
		const ac = new AbortController();
		const res = await open(`${srv.url}/stream`, ac);
		await readUntil(res.body!.getReader(), 'retry:');
		ac.abort();
		await until(() => srv.state.cleaned === 1);
	} finally {
		await srv.close();
	}
});

test('koa: ordinary responses are unchanged (buffered, Content-Length)', async () => {
	const srv = await start();
	try {
		const res = await fetch(`${srv.url}/json`);
		assert.equal(res.headers.get('content-length'), String(JSON.stringify({ ok: true }).length));
		assert.deepEqual(await res.json(), { ok: true });
	} finally {
		await srv.close();
	}
});
