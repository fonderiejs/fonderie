import { describe, it, before, after } from 'node:test';
import assert                          from 'node:assert/strict';

import { EventBus }        from '../bus';
import { MemoryTransport } from '../transports/memory';
import { matchesPattern }  from '../transports/pattern';

// ── Pattern matching unit tests ────────────────────────────────────────

describe('matchesPattern', () => {
	it('* matches everything', () => {
		assert.ok(matchesPattern('*', 'auth.user.registered'))
		assert.ok(matchesPattern('*', 'x'))
	})

	it('exact match', () => {
		assert.ok(matchesPattern('auth.user.registered', 'auth.user.registered'))
		assert.ok(!matchesPattern('auth.user.registered', 'auth.user.deleted'))
	})

	it('prefix wildcard — sport.*', () => {
		assert.ok(matchesPattern('sport.*', 'sport.event.created'))
		assert.ok(matchesPattern('sport.*', 'sport.highlights.published'))
		assert.ok(!matchesPattern('sport.*', 'news.article.created'))
	})

	it('suffix wildcard — *.created', () => {
		assert.ok(matchesPattern('*.created', 'auth.user.created'))
		assert.ok(matchesPattern('*.created', 'news.article.created'))
		assert.ok(!matchesPattern('*.created', 'news.article.updated'))
	})

	it('middle wildcard — sport.*.created', () => {
		assert.ok(matchesPattern('sport.*.created', 'sport.event.created'))
		assert.ok(matchesPattern('sport.*.created', 'sport.highlights.created'))
		assert.ok(!matchesPattern('sport.*.created', 'sport.event.updated'))
		assert.ok(!matchesPattern('sport.*.created', 'news.article.created'))
	})
})

// ── EventBus (memory transport) ────────────────────────────────────────

describe('EventBus — memory transport', () => {
	let bus: EventBus;

	before(async () => {
		bus = new EventBus(new MemoryTransport());
		await bus.start();
	});

	after(async () => {
		await bus.stop();
	});

	it('delivers a typed event to an exact-match handler', async () => {
		const received: unknown[] = [];
		bus.on<{ userId: string }>('user.registered', async (payload) => {
			received.push(payload);
		});

		await bus.emit('user.registered', { userId: 'u-1' });

		assert.equal(received.length, 1);
		assert.deepEqual(received[0], { userId: 'u-1' });
	});

	it('delivers to wildcard * handler', async () => {
		const types: string[] = [];
		bus.on<unknown>('*', async (_payload, meta) => {
			types.push(meta.type);
		}, 'global-logger');

		await bus.emit('user.deleted',  { userId: 'u-2' });
		await bus.emit('user.verified', { userId: 'u-3' });

		assert.ok(types.includes('user.deleted'));
		assert.ok(types.includes('user.verified'));
	});

	it('delivers to prefix pattern — auth.*', async () => {
		const received: string[] = [];
		bus.on<unknown>('auth.*', async (_p, meta) => {
			received.push(meta.type);
		}, 'auth-consumer');

		await bus.emit('auth.user.registered', {});
		await bus.emit('billing.subscription.created', {});

		assert.ok(received.includes('auth.user.registered'));
		assert.ok(!received.includes('billing.subscription.created'));
	});

	it('delivers to suffix pattern — *.created', async () => {
		const received: string[] = [];
		bus.on<unknown>('*.created', async (_p, meta) => {
			received.push(meta.type);
		}, 'created-indexer');

		await bus.emit('news.article.created',  {});
		await bus.emit('sport.event.created',   {});
		await bus.emit('news.article.updated',  {});

		assert.ok(received.includes('news.article.created'));
		assert.ok(received.includes('sport.event.created'));
		assert.ok(!received.includes('news.article.updated'));
	});

	it('does not deliver to unrelated handlers', async () => {
		const received: unknown[] = [];
		bus.on<unknown>('order.created', async (p) => { received.push(p) }, 'orders');

		await bus.emit('invoice.created', { id: 'inv-1' });

		assert.equal(received.length, 0);
	});

	it('passes requestId through meta', async () => {
		let capturedMeta: { requestId?: string } | undefined;
		bus.on<unknown>('ping', async (_p, meta) => { capturedMeta = meta }, 'ping-consumer');

		await bus.emit('ping', {}, { requestId: 'req-abc' });

		assert.equal(capturedMeta?.requestId, 'req-abc');
	});
});
