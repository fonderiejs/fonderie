import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { drainQueue } from '../index';

function listen(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
	return new Promise((resolve) => {
		const server = app.listen(0, () => {
			const addr = server.address() as { port: number };
			resolve({
				url: `http://127.0.0.1:${addr.port}`,
				close: () => new Promise<void>((r) => server.close(() => r())),
			});
		});
	});
}

test('drainQueue: drains AFTER the response, never before it', async () => {
	// The ordering is the whole point. Draining first would make every caller
	// wait on somebody else's queued work.
	const order: string[] = [];
	let drainStarted!: () => void;
	const started = new Promise<void>((r) => { drainStarted = r; });

	const app = express();
	app.use(drainQueue({
		drain: async () => { order.push('drain'); drainStarted(); },
	}));
	app.get('/', (_req, res) => { order.push('response'); res.json({ ok: true }); });

	const server = await listen(app);
	try {
		const res = await fetch(server.url);
		assert.equal(res.status, 200);
		// Assert ORDER, not absence. 'finish' can fire before the client's fetch
		// resolves, so "has the drain run yet?" is a race; "did it ever run
		// first?" is the actual contract.
		assert.equal(order[0], 'response', 'the drain ran before the response was produced');
		await started;
		assert.deepEqual(order, ['response', 'drain']);
	} finally {
		await server.close();
	}
});

test('drainQueue: a failing drain never breaks the request', async () => {
	// Background work must not be able to fail the response that triggered it.
	let reported: unknown;
	const app = express();
	app.use(drainQueue(
		{ drain: async () => { throw new Error('pooler exploded'); } },
		{ onError: (e) => { reported = e; } },
	));
	app.get('/', (_req, res) => res.json({ ok: true }));

	const server = await listen(app);
	try {
		const res = await fetch(server.url);
		assert.equal(res.status, 200, 'the response must still be a clean 200');
		await new Promise((r) => setTimeout(r, 50));
		assert.match(String((reported as Error)?.message), /pooler exploded/);
	} finally {
		await server.close();
	}
});

test('drainQueue: concurrent responses share ONE drain', async () => {
	// Not correctness — claims are exclusive either way — but an instance
	// should not start N drains for N simultaneous responses.
	let active = 0;
	let peak = 0;
	let calls = 0;

	const app = express();
	app.use(drainQueue({
		drain: async () => {
			calls += 1;
			active += 1;
			peak = Math.max(peak, active);
			await new Promise((r) => setTimeout(r, 40));
			active -= 1;
		},
	}));
	app.get('/', (_req, res) => res.json({ ok: true }));

	const server = await listen(app);
	try {
		await Promise.all(Array.from({ length: 8 }, () => fetch(server.url).then((r) => r.text())));
		await new Promise((r) => setTimeout(r, 120));
		assert.equal(peak, 1, 'only one drain should be in flight at a time');
		assert.ok(calls < 8, `8 responses should not start 8 drains (started ${calls})`);
	} finally {
		await server.close();
	}
});

// Deterministic form of the test above. On CI the 8 "concurrent" requests
// arrived one by one, and each response's drain waited for the PREVIOUS drain
// (it was counted as background work), so they ran in a row: 8 drains.
test('drainQueue: a response during a running drain joins it, sequential requests included', async () => {
	let calls = 0;
	const app = express();
	app.use(drainQueue({
		drain: async () => {
			calls += 1;
			await new Promise((r) => setTimeout(r, 200));
		},
	}));
	app.get('/', (_req, res) => res.json({ ok: true }));

	const server = await listen(app);
	try {
		for (let i = 0; i < 3; i++) await fetch(server.url).then((r) => r.text());
		// Long enough for chained drains to show (3 × 200 ms), and for any drain
		// a previous test left running to finish first.
		await new Promise((r) => setTimeout(r, 1_200));
		assert.equal(calls, 1, `3 responses inside one drain should start 1 drain (started ${calls})`);
	} finally {
		await server.close();
	}
});
