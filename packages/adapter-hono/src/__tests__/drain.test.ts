import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Hono } from 'hono';

import { background, setBackgroundRunner } from '@fonderie/core';

import { drainQueue } from '../index';

// The production race, reproduced: a platform runner (Vercel's waitUntil) makes
// background(emit) return at once, so the event is written a moment AFTER the
// response — and a drain started immediately found nothing; the instance then
// froze and the event sat pending (live sign-out never arrived).
test("drainQueue drains AFTER the request's own background work — the event it emitted is delivered", async () => {
	const handed: Promise<unknown>[] = [];
	setBackgroundRunner((w) => handed.push(w));
	const queue: string[] = [];
	const delivered: string[] = [];
	const bus = {
		drain: async () => {
			delivered.push(...queue.splice(0));
			return 0;
		},
	};
	try {
		const app = new Hono();
		app.use('*', drainQueue(bus as never));
		app.post('/sessions/x/revoke', async (c) => {
			// Like auth: the emit is handed to the background runner.
			await background(new Promise<void>((r) => setTimeout(() => { queue.push('fonderie.session.revoked'); r(); }, 30)));
			return c.json({ ok: true });
		});
		const res = await app.request('http://localhost/sessions/x/revoke', { method: 'POST' });
		assert.equal(res.status, 200);
		// What the platform keeps alive after the response.
		while (handed.length) await Promise.all(handed.splice(0));
		assert.deepEqual(delivered, ['fonderie.session.revoked']);
	} finally {
		setBackgroundRunner(null);
	}
});
