import assert from 'node:assert/strict';
import test from 'node:test';

import { runWorker } from '../worker';
import type { EventBus } from '../bus';

/**
 * runWorker exists so the hosting decision is not a code change. These pin the
 * three topologies it must satisfy, because each fails differently and
 * silently:
 *
 *   • run-once must EXIT, or the job platform waits forever and eventually
 *     records a timeout for work that actually succeeded
 *   • scale-to-zero must serve HTTP, or the platform can never wake a stopped
 *     instance and the cheap tier is unusable
 *   • always-on must drain on its own, or a host with no trigger consumes
 *     nothing at all
 *
 * The transport itself is exercised against real Postgres in claiming.test.ts.
 * The question here is this entrypoint's control flow.
 */

function fakeBus(opts: { onDrain?: () => Promise<void> | void } = {}) {
	const calls = { start: 0, drain: 0, stop: 0 };
	const bus = {
		start: async () => { calls.start++; },
		drain: async () => { calls.drain++; await opts.onDrain?.(); },
		stop: async () => { calls.stop++; },
	} as unknown as EventBus;
	return { bus, calls };
}

test('once: drains and exits, leaving nothing running', async () => {
	const { bus, calls } = fakeBus();
	const handle = await runWorker(bus, { once: true });
	assert.equal(calls.start, 1);
	assert.equal(calls.drain, 1);
	assert.equal(calls.stop, 1, 'a run-once worker must release the transport, or the job never ends');
	await handle.done;
});

test('always-on: drains on boot rather than waiting out the interval', async () => {
	// A container starting with a backlog should not sit idle for a full
	// interval first; on a slow interval that delay IS the latency.
	const { bus, calls } = fakeBus();
	const handle = await runWorker(bus, { intervalMs: 0 });
	await new Promise((r) => setTimeout(r, 50));
	assert.equal(calls.drain, 1, 'boot must trigger an immediate pass');
	await handle.stop();
	assert.equal(calls.stop, 1);
});

test('always-on: the timer keeps draining with no trigger at all', async () => {
	const { bus, calls } = fakeBus();
	const handle = await runWorker(bus, { intervalMs: 30 });
	await new Promise((r) => setTimeout(r, 150));
	assert.ok(calls.drain >= 3, `expected repeated passes, saw ${calls.drain}`);
	await handle.stop();
});

test('scale-to-zero: POST /drain runs a pass and answers only once it is done', async () => {
	const { bus, calls } = fakeBus({ onDrain: () => new Promise((r) => setTimeout(r, 60)) });
	const handle = await runWorker(bus, { port: 0, secret: 's3cret', intervalMs: 0 });
	assert.ok(handle.port, 'the bound port must be readable — port 0 asks the OS to choose');

	await new Promise((r) => setTimeout(r, 80)); // let the boot pass finish
	const before = calls.drain;
	const started = Date.now();
	const res = await fetch(`http://127.0.0.1:${handle.port}/drain`, {
		method: 'POST',
		headers: { authorization: 'Bearer s3cret' },
	});
	assert.equal(res.status, 200);
	assert.ok(calls.drain > before, 'the request must actually trigger a drain');
	assert.ok(
		Date.now() - started >= 50,
		'the response must wait for the drain — answering early bills the platform for work outliving its request, and hides failures',
	);
	await handle.stop();
});

test('scale-to-zero: /drain rejects a wrong, malformed or missing secret', async () => {
	const { bus, calls } = fakeBus();
	const handle = await runWorker(bus, { port: 0, secret: 's3cret', intervalMs: 0 });
	await new Promise((r) => setTimeout(r, 30));
	const before = calls.drain;

	for (const headers of [{}, { authorization: 'Bearer wrong' }, { authorization: 's3cret' }]) {
		const res = await fetch(`http://127.0.0.1:${handle.port}/drain`, { method: 'POST', headers });
		assert.equal(res.status, 401, `must reject ${JSON.stringify(headers)}`);
	}
	assert.equal(calls.drain, before, 'a rejected request must not have done any work');
	await handle.stop();
});

test('scale-to-zero: /health answers unauthenticated, so a platform can probe it', async () => {
	const { bus } = fakeBus();
	const handle = await runWorker(bus, { port: 0, secret: 's3cret', intervalMs: 0 });
	const res = await fetch(`http://127.0.0.1:${handle.port}/health`);
	assert.equal(res.status, 200);
	assert.equal(((await res.json()) as { ok: boolean }).ok, true);
	await handle.stop();
});

test('a port with no secret is refused at boot, not served openly', async () => {
	// The drain is the expensive half of the system, so an unauthenticated
	// endpoint is a public "do work" button. Fail the deploy instead.
	const { bus } = fakeBus();
	await assert.rejects(() => runWorker(bus, { port: 0 }), /secret/);
});

test('overlapping wakes coalesce into one pass, and the later one still runs', async () => {
	// Several requests can land on one instance. Running them concurrently is
	// wasteful; dropping the later one loses work published after the running
	// pass began scanning. It must run again instead.
	let release!: () => void;
	const gate = new Promise<void>((r) => { release = r; });
	let n = 0;
	const { bus, calls } = fakeBus({ onDrain: () => (++n === 1 ? gate : undefined) });

	const handle = await runWorker(bus, { port: 0, secret: 's', intervalMs: 0 });
	await new Promise((r) => setTimeout(r, 30)); // boot pass now blocked in the gate
	assert.equal(calls.drain, 1);

	// Three wakes arrive while the first pass is still running.
	const wakes = [0, 1, 2].map(() =>
		fetch(`http://127.0.0.1:${handle.port}/drain`, {
			method: 'POST',
			headers: { authorization: 'Bearer s' },
		}),
	);
	await new Promise((r) => setTimeout(r, 30));
	assert.equal(calls.drain, 1, 'no concurrent second pass while one is in flight');

	release();
	await Promise.all(wakes);
	assert.equal(calls.drain, 2, 'the wakes that arrived mid-pass collapse into exactly one follow-up');
	await handle.stop();
});

test('once: drains EVERY bus it was given, then exits', async () => {
	// A worker process usually owns more than one consumer — a job queue and a
	// notification queue. Draining only one leaves the others LISTENing, so the
	// work finishes but the process never exits and a job platform records a
	// timeout for a run that actually succeeded. That is exactly how this first
	// failed in LeadEasyGen.
	const a = fakeBus();
	const b = fakeBus();
	await runWorker([a.bus, b.bus], { once: true });
	assert.equal(a.calls.drain, 1);
	assert.equal(b.calls.drain, 1, 'the second bus must be drained too');
	assert.equal(a.calls.stop, 1);
	assert.equal(b.calls.stop, 1, 'every bus must be released, or the process hangs');
});

test('a failing drain never kills the worker', async () => {
	// A worker that exits on one bad pass turns a transient database blip into
	// a queue that stays stopped until a human notices.
	const errors: unknown[] = [];
	const { bus, calls } = fakeBus({ onDrain: () => { throw new Error('boom'); } });
	const handle = await runWorker(bus, { intervalMs: 0, onError: (e) => errors.push(e) });
	await new Promise((r) => setTimeout(r, 40));
	assert.equal(calls.drain, 1);
	assert.equal(errors.length, 1, 'the failure is reported, not swallowed');
	await handle.stop();
	assert.equal(calls.stop, 1, 'and the worker is still healthy enough to stop cleanly');
});

test('stop() waits for the pass in flight before releasing the transport', async () => {
	// Scale-to-zero platforms SIGTERM routinely, so abandoning mid-drain is the
	// normal case. Rows left 'processing' wait out their lease before anyone
	// retries them — delivery delayed for no reason.
	let release!: () => void;
	const gate = new Promise<void>((r) => { release = r; });
	let n = 0;
	const order: string[] = [];
	const calls = { stop: 0 };
	const bus = {
		start: async () => {},
		drain: async () => { if (++n === 1) { await gate; order.push('drain-done'); } },
		stop: async () => { calls.stop++; order.push('transport-stopped'); },
	} as unknown as EventBus;

	const handle = await runWorker(bus, { intervalMs: 0 });
	await new Promise((r) => setTimeout(r, 20));
	const stopping = handle.stop();
	await new Promise((r) => setTimeout(r, 20));
	assert.equal(calls.stop, 0, 'must not release the transport while a drain is running');
	release();
	await stopping;
	assert.deepEqual(order, ['drain-done', 'transport-stopped']);
});
