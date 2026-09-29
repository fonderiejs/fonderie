import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

import { FonderieApp, defineConfig, sseResponse, type ISseStream } from '@fonderie/core';

import { bridge, mount } from '../index';

// Hono hands the Web Response to its runtime untouched, so it already streamed;
// this pins it: events arrive while the stream is open, and the Request's
// signal (the runtime's disconnect) reaches the handler through bridge().

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

async function app() {
	const state: { stream?: ISseStream; cleaned: number } = { cleaned: 0 };
	const fonderie = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	fonderie.addRoute('GET', '/stream', async (ctx) =>
		sseResponse(ctx.request.signal, (s) => {
			state.stream = s;
			return () => { state.cleaned++; };
		}, { heartbeatMs: 0 }),
	);
	await fonderie.boot();
	const hono = new Hono();
	hono.use('*', bridge(fonderie));
	mount(hono, fonderie);
	return { hono, state };
}

test('hono: an SSE route streams — events arrive while it stays open', async () => {
	const { hono, state } = await app();
	const ac = new AbortController();
	const res = await hono.fetch(new Request('http://x/stream', { signal: ac.signal }));
	assert.ok(res.headers.get('content-type')?.startsWith('text/event-stream'));
	const reader = res.body!.getReader();
	await readUntil(reader, 'retry:');
	await until(() => state.stream !== undefined);
	state.stream!.send({ event: 'config.changed', data: { environment: 'production' } });
	assert.match(await readUntil(reader, 'config.changed'), /event: config\.changed/);
	ac.abort();
});

test("hono: the runtime's disconnect signal reaches the handler and runs cleanup", async () => {
	const { hono, state } = await app();
	const ac = new AbortController();
	const res = await hono.fetch(new Request('http://x/stream', { signal: ac.signal }));
	await readUntil(res.body!.getReader(), 'retry:');
	ac.abort();
	await until(() => state.cleaned === 1);
});
